"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLSchemaBuilder = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const load_package_util_1 = require("@nestjs/common/utils/load-package.util");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const graphql_1 = require("graphql");
const path_1 = require("path");
const graphql_constants_1 = require("./graphql.constants");
const graphql_schema_factory_1 = require("./schema-builder/graphql-schema.factory");
const file_system_helper_1 = require("./schema-builder/helpers/file-system.helper");
const services_1 = require("./services");
let GraphQLSchemaBuilder = class GraphQLSchemaBuilder {
    constructor(scalarsExplorerService, gqlSchemaFactory, fileSystemHelper) {
        this.scalarsExplorerService = scalarsExplorerService;
        this.gqlSchemaFactory = gqlSchemaFactory;
        this.fileSystemHelper = fileSystemHelper;
    }
    async build(autoSchemaFile, options, resolvers) {
        const scalarsMap = this.scalarsExplorerService.getScalarsMap();
        try {
            const buildSchemaOptions = options.buildSchemaOptions || {};
            return await this.buildSchema(resolvers, autoSchemaFile, {
                ...buildSchemaOptions,
                scalarsMap,
                schemaDirectives: options.schemaDirectives,
                schemaTransforms: options.schemaTransforms,
            }, options.sortSchema, options.transformAutoSchemaFile && options.transformSchema);
        }
        catch (err) {
            if (err && err.details) {
                console.error(err.details);
            }
            throw err;
        }
    }
    async buildFederatedSchema(autoSchemaFile, options, resolvers) {
        const scalarsMap = this.scalarsExplorerService.getScalarsMap();
        try {
            const buildSchemaOptions = options.buildSchemaOptions || {};
            return await this.buildSchema(resolvers, autoSchemaFile, {
                ...buildSchemaOptions,
                directives: [
                    ...graphql_1.specifiedDirectives,
                    ...this.loadFederationDirectives(),
                    ...((buildSchemaOptions && buildSchemaOptions.directives) || []),
                ],
                scalarsMap,
                schemaDirectives: options.schemaDirectives,
                skipCheck: true,
            }, options.sortSchema, options.transformAutoSchemaFile && options.transformSchema);
        }
        catch (err) {
            if (err && err.details) {
                console.error(err.details);
            }
            throw err;
        }
    }
    async buildSchema(resolvers, autoSchemaFile, options = {}, sortSchema, transformSchema) {
        const schema = await this.gqlSchemaFactory.create(resolvers, options);
        if (typeof autoSchemaFile !== 'boolean') {
            const filename = shared_utils_1.isString(autoSchemaFile)
                ? autoSchemaFile
                : path_1.resolve(process.cwd(), 'schema.gql');
            const transformedSchema = transformSchema
                ? await transformSchema(schema)
                : schema;
            const fileContent = graphql_constants_1.GRAPHQL_SDL_FILE_HEADER +
                graphql_1.printSchema(sortSchema
                    ? graphql_1.lexicographicSortSchema(transformedSchema)
                    : transformedSchema);
            await this.fileSystemHelper.writeFile(filename, fileContent);
        }
        return schema;
    }
    loadFederationDirectives() {
        const { federationDirectives } = load_package_util_1.loadPackage('@apollo/federation/dist/directives', 'SchemaBuilder', () => require('@apollo/federation/dist/directives'));
        return federationDirectives;
    }
};
GraphQLSchemaBuilder = tslib_1.__decorate([
    common_1.Injectable(),
    tslib_1.__metadata("design:paramtypes", [services_1.ScalarsExplorerService,
        graphql_schema_factory_1.GraphQLSchemaFactory,
        file_system_helper_1.FileSystemHelper])
], GraphQLSchemaBuilder);
exports.GraphQLSchemaBuilder = GraphQLSchemaBuilder;
