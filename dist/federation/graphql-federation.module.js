"use strict";
var GraphQLFederationModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLFederationModule = void 0;
const tslib_1 = require("tslib");
const utils_1 = require("@graphql-tools/utils");
const common_1 = require("@nestjs/common");
const load_package_util_1 = require("@nestjs/common/utils/load-package.util");
const core_1 = require("@nestjs/core");
const metadata_scanner_1 = require("@nestjs/core/metadata-scanner");
const graphql_ast_explorer_1 = require("../graphql-ast.explorer");
const graphql_schema_builder_1 = require("../graphql-schema.builder");
const graphql_schema_host_1 = require("../graphql-schema.host");
const graphql_types_loader_1 = require("../graphql-types.loader");
const graphql_constants_1 = require("../graphql.constants");
const graphql_factory_1 = require("../graphql.factory");
const schema_builder_module_1 = require("../schema-builder/schema-builder.module");
const services_1 = require("../services");
const utils_2 = require("../utils");
const graphql_federation_factory_1 = require("./graphql-federation.factory");
let GraphQLFederationModule = GraphQLFederationModule_1 = class GraphQLFederationModule {
    constructor(httpAdapterHost, options, graphqlFederationFactory, graphqlTypesLoader, graphqlFactory, applicationConfig) {
        this.httpAdapterHost = httpAdapterHost;
        this.options = options;
        this.graphqlFederationFactory = graphqlFederationFactory;
        this.graphqlTypesLoader = graphqlTypesLoader;
        this.graphqlFactory = graphqlFactory;
        this.applicationConfig = applicationConfig;
    }
    get apolloServer() {
        return this._apolloServer;
    }
    static forRoot(options = {}) {
        options = utils_2.mergeDefaults(options);
        return {
            module: GraphQLFederationModule_1,
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
            module: GraphQLFederationModule_1,
            imports: options.imports,
            providers: [
                ...this.createAsyncProviders(options),
                {
                    provide: graphql_constants_1.GRAPHQL_MODULE_ID,
                    useValue: utils_2.generateString(),
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
                useFactory: async (...args) => utils_2.mergeDefaults(await options.useFactory(...args)),
                inject: options.inject || [],
            };
        }
        return {
            provide: graphql_constants_1.GRAPHQL_MODULE_OPTIONS,
            useFactory: async (optionsFactory) => utils_2.mergeDefaults(await optionsFactory.createGqlOptions()),
            inject: [options.useExisting || options.useClass],
        };
    }
    async onModuleInit() {
        if (!this.httpAdapterHost || !this.httpAdapterHost.httpAdapter) {
            return;
        }
        const { printSchema } = load_package_util_1.loadPackage('@apollo/federation', 'ApolloFederation', () => require('@apollo/federation'));
        const { typePaths } = this.options;
        const typeDefs = (await this.graphqlTypesLoader.mergeTypesByPaths(typePaths)) || [];
        const mergedTypeDefs = utils_2.extend(typeDefs, this.options.typeDefs);
        const apolloOptions = await this.graphqlFederationFactory.mergeOptions({
            ...this.options,
            typeDefs: mergedTypeDefs,
        });
        await this.runExecutorFactoryIfPresent(apolloOptions);
        if (this.options.definitions && this.options.definitions.path) {
            await this.graphqlFactory.generateDefinitions(printSchema(apolloOptions.schema), this.options);
        }
        await this.registerGqlServer(apolloOptions);
        if (this.options.installSubscriptionHandlers ||
            this.options.subscriptions) {
            throw new Error('No support for subscriptions yet when using Apollo Federation');
        }
    }
    async onModuleDestroy() {
        var _a;
        await ((_a = this._apolloServer) === null || _a === void 0 ? void 0 : _a.stop());
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
        const { disableHealthCheck, onHealthCheck, cors, bodyParserConfig } = this.options;
        const app = this.httpAdapterHost.httpAdapter.getInstance();
        const path = this.getNormalizedPath(apolloOptions);
        if (apolloOptions.schemaDirectives) {
            utils_1.SchemaDirectiveVisitor.visitSchemaDirectives(apolloOptions.schema, apolloOptions.schemaDirectives);
        }
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
        if (apolloOptions.schemaDirectives) {
            utils_1.SchemaDirectiveVisitor.visitSchemaDirectives(apolloOptions.schema, apolloOptions.schemaDirectives);
        }
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
        const gqlOptionsPath = utils_2.normalizeRoutePath(apolloOptions.path);
        return useGlobalPrefix
            ? utils_2.normalizeRoutePath(prefix) + gqlOptionsPath
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
GraphQLFederationModule = GraphQLFederationModule_1 = tslib_1.__decorate([
    common_1.Module({
        imports: [schema_builder_module_1.GraphQLSchemaBuilderModule],
        providers: [
            graphql_federation_factory_1.GraphQLFederationFactory,
            graphql_factory_1.GraphQLFactory,
            metadata_scanner_1.MetadataScanner,
            services_1.ResolversExplorerService,
            services_1.PluginsExplorerService,
            services_1.ScalarsExplorerService,
            graphql_ast_explorer_1.GraphQLAstExplorer,
            graphql_types_loader_1.GraphQLTypesLoader,
            graphql_schema_builder_1.GraphQLSchemaBuilder,
            graphql_schema_host_1.GraphQLSchemaHost,
        ],
        exports: [graphql_schema_host_1.GraphQLSchemaHost, graphql_types_loader_1.GraphQLTypesLoader, graphql_ast_explorer_1.GraphQLAstExplorer],
    }),
    tslib_1.__param(0, common_1.Optional()),
    tslib_1.__param(1, common_1.Inject(graphql_constants_1.GRAPHQL_MODULE_OPTIONS)),
    tslib_1.__metadata("design:paramtypes", [core_1.HttpAdapterHost, Object, graphql_federation_factory_1.GraphQLFederationFactory,
        graphql_types_loader_1.GraphQLTypesLoader,
        graphql_factory_1.GraphQLFactory,
        core_1.ApplicationConfig])
], GraphQLFederationModule);
exports.GraphQLFederationModule = GraphQLFederationModule;
