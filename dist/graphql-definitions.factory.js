"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLDefinitionsFactory = void 0;
const schema_1 = require("@graphql-tools/schema");
const load_package_util_1 = require("@nestjs/common/utils/load-package.util");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const apollo_server_core_1 = require("apollo-server-core");
const chokidar = require("chokidar");
const graphql_1 = require("graphql");
const graphql_ast_explorer_1 = require("./graphql-ast.explorer");
const graphql_types_loader_1 = require("./graphql-types.loader");
const utils_1 = require("./utils");
class GraphQLDefinitionsFactory {
    constructor() {
        this.gqlAstExplorer = new graphql_ast_explorer_1.GraphQLAstExplorer();
        this.gqlTypesLoader = new graphql_types_loader_1.GraphQLTypesLoader();
    }
    async generate(options) {
        const isDebugEnabled = !(options && options.debug === false);
        const typePathsExists = options.typePaths && !shared_utils_1.isEmpty(options.typePaths);
        if (!typePathsExists) {
            throw new Error(`"typePaths" property cannot be empty.`);
        }
        const isFederation = options && options.federation;
        const definitionsGeneratorOptions = {
            emitTypenameField: options.emitTypenameField,
            skipResolverArgs: options.skipResolverArgs,
            defaultScalarType: options.defaultScalarType,
            customScalarTypeMapping: options.customScalarTypeMapping,
            additionalHeader: options.additionalHeader,
            defaultTypeMapping: options.defaultTypeMapping,
            enumsAsTypes: options.enumsAsTypes,
        };
        if (options.watch) {
            this.printMessage('GraphQL factory is watching your files...', isDebugEnabled);
            const watcher = chokidar.watch(options.typePaths);
            watcher.on('change', async (file) => {
                this.printMessage(`[${new Date().toLocaleTimeString()}] "${file}" has been changed.`, isDebugEnabled);
                await this.exploreAndEmit(options.typePaths, options.path, options.outputAs, isFederation, isDebugEnabled, definitionsGeneratorOptions, options.typeDefs);
            });
        }
        await this.exploreAndEmit(options.typePaths, options.path, options.outputAs, isFederation, isDebugEnabled, definitionsGeneratorOptions, options.typeDefs);
    }
    async exploreAndEmit(typePaths, path, outputAs, isFederation, isDebugEnabled, definitionsGeneratorOptions = {}, typeDefs) {
        if (isFederation) {
            return this.exploreAndEmitFederation(typePaths, path, outputAs, isDebugEnabled, definitionsGeneratorOptions, typeDefs);
        }
        return this.exploreAndEmitRegular(typePaths, path, outputAs, isDebugEnabled, definitionsGeneratorOptions, typeDefs);
    }
    async exploreAndEmitFederation(typePaths, path, outputAs, isDebugEnabled, definitionsGeneratorOptions, typeDefs) {
        const typePathDefs = await this.gqlTypesLoader.mergeTypesByPaths(typePaths);
        const mergedTypeDefs = utils_1.extend(typePathDefs, typeDefs);
        const { buildFederatedSchema, printSchema, } = load_package_util_1.loadPackage('@apollo/federation', 'ApolloFederation', () => require('@apollo/federation'));
        const schema = buildFederatedSchema([
            {
                typeDefs: apollo_server_core_1.gql `
          ${mergedTypeDefs}
        `,
                resolvers: {},
            },
        ]);
        const tsFile = await this.gqlAstExplorer.explore(apollo_server_core_1.gql `
        ${printSchema(schema)}
      `, path, outputAs, definitionsGeneratorOptions);
        await tsFile.save();
        this.printMessage(`[${new Date().toLocaleTimeString()}] The definitions have been updated.`, isDebugEnabled);
    }
    async exploreAndEmitRegular(typePaths, path, outputAs, isDebugEnabled, definitionsGeneratorOptions, typeDefs) {
        const typePathDefs = await this.gqlTypesLoader.mergeTypesByPaths(typePaths || []);
        const mergedTypeDefs = utils_1.extend(typePathDefs, typeDefs);
        if (!mergedTypeDefs) {
            throw new Error(`"typeDefs" property cannot be null.`);
        }
        let schema = schema_1.makeExecutableSchema({
            typeDefs: mergedTypeDefs,
            resolverValidationOptions: { requireResolversToMatchSchema: 'ignore' },
        });
        schema = utils_1.removeTempField(schema);
        const tsFile = await this.gqlAstExplorer.explore(apollo_server_core_1.gql `
        ${graphql_1.printSchema(schema)}
      `, path, outputAs, definitionsGeneratorOptions);
        await tsFile.save();
        this.printMessage(`[${new Date().toLocaleTimeString()}] The definitions have been updated.`, isDebugEnabled);
    }
    printMessage(text, isEnabled) {
        isEnabled && console.log(text);
    }
}
exports.GraphQLDefinitionsFactory = GraphQLDefinitionsFactory;
