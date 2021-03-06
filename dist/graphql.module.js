"use strict";
var GraphQLModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const load_package_util_1 = require("@nestjs/common/utils/load-package.util");
const core_1 = require("@nestjs/core");
const metadata_scanner_1 = require("@nestjs/core/metadata-scanner");
const graphql_1 = require("graphql");
const graphql_ast_explorer_1 = require("./graphql-ast.explorer");
const graphql_schema_builder_1 = require("./graphql-schema.builder");
const graphql_schema_host_1 = require("./graphql-schema.host");
const graphql_types_loader_1 = require("./graphql-types.loader");
const graphql_subscription_service_1 = require("./graphql-ws/graphql-subscription.service");
const graphql_constants_1 = require("./graphql.constants");
const graphql_factory_1 = require("./graphql.factory");
const schema_builder_module_1 = require("./schema-builder/schema-builder.module");
const services_1 = require("./services");
const utils_1 = require("./utils");
let GraphQLModule = GraphQLModule_1 = class GraphQLModule {
    constructor(httpAdapterHost, options, graphqlFactory, graphqlTypesLoader, applicationConfig) {
        this.httpAdapterHost = httpAdapterHost;
        this.options = options;
        this.graphqlFactory = graphqlFactory;
        this.graphqlTypesLoader = graphqlTypesLoader;
        this.applicationConfig = applicationConfig;
    }
    get apolloServer() {
        return this._apolloServer;
    }
    static forRoot(options = {}) {
        options = utils_1.mergeDefaults(options);
        return {
            module: GraphQLModule_1,
            providers: [
                {
                    provide: graphql_constants_1.GRAPHQL_MODULE_OPTIONS,
                    useValue: options,
                },
            ],
        };
    }
    static forRootAsync(options) {
        return {
            module: GraphQLModule_1,
            imports: options.imports,
            providers: [
                ...this.createAsyncProviders(options),
                {
                    provide: graphql_constants_1.GRAPHQL_MODULE_ID,
                    useValue: utils_1.generateString(),
                },
            ],
        };
    }
    static createAsyncProviders(options) {
        if (options.useExisting || options.useFactory) {
            return [this.createAsyncOptionsProvider(options)];
        }
        return [
            this.createAsyncOptionsProvider(options),
            {
                provide: options.useClass,
                useClass: options.useClass,
            },
        ];
    }
    static createAsyncOptionsProvider(options) {
        if (options.useFactory) {
            return {
                provide: graphql_constants_1.GRAPHQL_MODULE_OPTIONS,
                useFactory: async (...args) => utils_1.mergeDefaults(await options.useFactory(...args)),
                inject: options.inject || [],
            };
        }
        return {
            provide: graphql_constants_1.GRAPHQL_MODULE_OPTIONS,
            useFactory: async (optionsFactory) => utils_1.mergeDefaults(await optionsFactory.createGqlOptions()),
            inject: [options.useExisting || options.useClass],
        };
    }
    async onModuleInit() {
        if (!this.httpAdapterHost) {
            return;
        }
        const httpAdapter = this.httpAdapterHost.httpAdapter;
        if (!httpAdapter) {
            return;
        }
        const typeDefs = (await this.graphqlTypesLoader.mergeTypesByPaths(this.options.typePaths)) || [];
        const mergedTypeDefs = utils_1.extend(typeDefs, this.options.typeDefs);
        const apolloOptions = await this.graphqlFactory.mergeOptions({
            ...this.options,
            typeDefs: mergedTypeDefs,
        });
        await this.runExecutorFactoryIfPresent(apolloOptions);
        if (this.options.definitions && this.options.definitions.path) {
            await this.graphqlFactory.generateDefinitions(graphql_1.printSchema(apolloOptions.schema), this.options);
        }
        await this.registerGqlServer(apolloOptions);
        if (this.options.installSubscriptionHandlers ||
            this.options.subscriptions) {
            const subscriptionsOptions = this.options
                .subscriptions || { 'subscriptions-transport-ws': {} };
            this._subscriptionService = new graphql_subscription_service_1.GraphQLSubscriptionService({
                schema: apolloOptions.schema,
                path: this.options.path,
                context: this.options.context,
                ...subscriptionsOptions,
            }, httpAdapter.getHttpServer());
        }
    }
    async onModuleDestroy() {
        var _a, _b;
        await ((_a = this._subscriptionService) === null || _a === void 0 ? void 0 : _a.stop());
        await ((_b = this._apolloServer) === null || _b === void 0 ? void 0 : _b.stop());
    }
    async registerGqlServer(apolloOptions) {
        const httpAdapter = this.httpAdapterHost.httpAdapter;
        const platformName = httpAdapter.getType();
        if (platformName === 'express') {
            await this.registerExpress(apolloOptions);
        }
        else if (platformName === 'fastify') {
            await this.registerFastify(apolloOptions);
        }
        else {
            throw new Error(`No support for current HttpAdapter: ${platformName}`);
        }
    }
    async registerExpress(apolloOptions) {
        const { ApolloServer } = load_package_util_1.loadPackage('apollo-server-express', 'GraphQLModule', () => require('apollo-server-express'));
        const path = this.getNormalizedPath(apolloOptions);
        const { disableHealthCheck, onHealthCheck, cors, bodyParserConfig } = this.options;
        const httpAdapter = this.httpAdapterHost.httpAdapter;
        const app = httpAdapter.getInstance();
        const apolloServer = new ApolloServer(apolloOptions);
        await apolloServer.start();
        apolloServer.applyMiddleware({
            app,
            path,
            disableHealthCheck,
            onHealthCheck,
            cors,
            bodyParserConfig,
        });
        this._apolloServer = apolloServer;
    }
    async registerFastify(apolloOptions) {
        const { ApolloServer } = load_package_util_1.loadPackage('apollo-server-fastify', 'GraphQLModule', () => require('apollo-server-fastify'));
        const httpAdapter = this.httpAdapterHost.httpAdapter;
        const app = httpAdapter.getInstance();
        const path = this.getNormalizedPath(apolloOptions);
        const apolloServer = new ApolloServer(apolloOptions);
        await apolloServer.start();
        const { disableHealthCheck, onHealthCheck, cors, bodyParserConfig } = this.options;
        await app.register(apolloServer.createHandler({
            disableHealthCheck,
            onHealthCheck,
            cors,
            bodyParserConfig,
            path,
        }));
        this._apolloServer = apolloServer;
    }
    getNormalizedPath(apolloOptions) {
        const prefix = this.applicationConfig.getGlobalPrefix();
        const useGlobalPrefix = prefix && this.options.useGlobalPrefix;
        const gqlOptionsPath = utils_1.normalizeRoutePath(apolloOptions.path);
        return useGlobalPrefix
            ? utils_1.normalizeRoutePath(prefix) + gqlOptionsPath
            : gqlOptionsPath;
    }
    async runExecutorFactoryIfPresent(apolloOptions) {
        if (!apolloOptions.executorFactory) {
            return;
        }
        const executor = await apolloOptions.executorFactory(apolloOptions.schema);
        apolloOptions.executor = executor;
    }
};
GraphQLModule = GraphQLModule_1 = tslib_1.__decorate([
    common_1.Module({
        imports: [schema_builder_module_1.GraphQLSchemaBuilderModule],
        providers: [
            graphql_factory_1.GraphQLFactory,
            metadata_scanner_1.MetadataScanner,
            services_1.ResolversExplorerService,
            services_1.ScalarsExplorerService,
            services_1.PluginsExplorerService,
            graphql_ast_explorer_1.GraphQLAstExplorer,
            graphql_types_loader_1.GraphQLTypesLoader,
            graphql_schema_builder_1.GraphQLSchemaBuilder,
            graphql_schema_host_1.GraphQLSchemaHost,
        ],
        exports: [graphql_types_loader_1.GraphQLTypesLoader, graphql_ast_explorer_1.GraphQLAstExplorer, graphql_schema_host_1.GraphQLSchemaHost],
    }),
    tslib_1.__param(1, common_1.Inject(graphql_constants_1.GRAPHQL_MODULE_OPTIONS)),
    tslib_1.__metadata("design:paramtypes", [core_1.HttpAdapterHost, Object, graphql_factory_1.GraphQLFactory,
        graphql_types_loader_1.GraphQLTypesLoader,
        core_1.ApplicationConfig])
], GraphQLModule);
exports.GraphQLModule = GraphQLModule;
