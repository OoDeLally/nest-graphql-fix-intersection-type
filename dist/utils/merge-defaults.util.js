"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeDefaults = void 0;
const common_1 = require("@nestjs/common");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const apollo_server_core_1 = require("apollo-server-core");
const lodash_1 = require("lodash");
const defaultOptions = {
    path: '/graphql',
    fieldResolverEnhancers: [],
    stopOnTerminationSignals: false,
};
function mergeDefaults(options, defaults = defaultOptions) {
    if ((options.playground === undefined &&
        process.env.NODE_ENV !== 'production') ||
        options.playground) {
        const playgroundOptions = typeof options.playground === 'object' ? options.playground : undefined;
        defaults = {
            ...defaults,
            plugins: [
                apollo_server_core_1.ApolloServerPluginLandingPageGraphQLPlayground(playgroundOptions),
            ],
        };
    }
    else if ((options.playground === undefined &&
        process.env.NODE_ENV === 'production') ||
        options.playground === false) {
        defaults = {
            ...defaults,
            plugins: [apollo_server_core_1.ApolloServerPluginLandingPageDisabled()],
        };
    }
    const moduleOptions = {
        ...lodash_1.omit(defaults, 'plugins'),
        ...options,
    };
    moduleOptions.plugins = (moduleOptions.plugins || []).concat(defaults.plugins || []);
    wrapContextResolver(moduleOptions, options);
    wrapFormatErrorFn(moduleOptions);
    return moduleOptions;
}
exports.mergeDefaults = mergeDefaults;
function wrapContextResolver(targetOptions, originalOptions) {
    if (!targetOptions.context) {
        targetOptions.context = ({ req, request }) => ({ req: req !== null && req !== void 0 ? req : request });
    }
    else if (shared_utils_1.isFunction(targetOptions.context)) {
        targetOptions.context = async (...args) => {
            const ctx = await originalOptions.context(...args);
            const { req, request } = args[0];
            return assignReqProperty(ctx, req !== null && req !== void 0 ? req : request);
        };
    }
    else {
        targetOptions.context = ({ req, request }) => {
            return assignReqProperty(originalOptions.context, req !== null && req !== void 0 ? req : request);
        };
    }
}
function assignReqProperty(ctx, req) {
    if (!ctx) {
        return { req };
    }
    if (typeof ctx !== 'object' ||
        (ctx && ctx.req && typeof ctx.req === 'object')) {
        return ctx;
    }
    ctx.req = req;
    return ctx;
}
const apolloPredefinedExceptions = {
    [common_1.HttpStatus.BAD_REQUEST]: apollo_server_core_1.UserInputError,
    [common_1.HttpStatus.UNAUTHORIZED]: apollo_server_core_1.AuthenticationError,
    [common_1.HttpStatus.FORBIDDEN]: apollo_server_core_1.ForbiddenError,
};
function wrapFormatErrorFn(options) {
    if (options.autoTransformHttpErrors === false) {
        return;
    }
    if (options.formatError) {
        const origFormatError = options.formatError;
        const transformHttpErrorFn = createTransformHttpErrorFn();
        options.formatError = (err) => {
            err = transformHttpErrorFn(err);
            return origFormatError(err);
        };
    }
    else {
        options.formatError = createTransformHttpErrorFn();
    }
}
function createTransformHttpErrorFn() {
    return (originalError) => {
        var _a, _b;
        const exceptionRef = (_a = originalError === null || originalError === void 0 ? void 0 : originalError.extensions) === null || _a === void 0 ? void 0 : _a.exception;
        const isHttpException = ((_b = exceptionRef === null || exceptionRef === void 0 ? void 0 : exceptionRef.response) === null || _b === void 0 ? void 0 : _b.statusCode) && (exceptionRef === null || exceptionRef === void 0 ? void 0 : exceptionRef.status);
        if (!isHttpException) {
            return originalError;
        }
        let error;
        const httpStatus = exceptionRef === null || exceptionRef === void 0 ? void 0 : exceptionRef.status;
        if (httpStatus in apolloPredefinedExceptions) {
            error = new apolloPredefinedExceptions[httpStatus](exceptionRef === null || exceptionRef === void 0 ? void 0 : exceptionRef.message);
        }
        else {
            error = new apollo_server_core_1.ApolloError(exceptionRef.message, httpStatus === null || httpStatus === void 0 ? void 0 : httpStatus.toString());
        }
        error.stack = exceptionRef === null || exceptionRef === void 0 ? void 0 : exceptionRef.stacktrace;
        error.extensions['response'] = exceptionRef === null || exceptionRef === void 0 ? void 0 : exceptionRef.response;
        return error;
    };
}
