import * as ts                               from "typescript";
import * as path                             from "path";
import {REFLECT_GENERIC_DECORATOR, TypeKind} from "tst-reflect";
import {State, STATE_PROP, StateNode}        from "./visitors/State";
import {transformerContext}                  from "./TransformerContext";

const rootDir = transformerContext.config.rootDir;

/**
 * Name of parameter for method/function declarations containing geneic getType() calls
 */
export const GENERIC_PARAMS = "__genericParams__";

/**
 * Package name/identifier
 */
export const PACKAGE_ID = "tst-reflect-transformer";

/**
 * Get type of symbol
 * @param symbol
 * @param checker
 */
export function getType(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Type
{
	if (symbol.flags == ts.SymbolFlags.Interface || symbol.flags == ts.SymbolFlags.Alias)
	{
		return checker.getDeclaredTypeOfSymbol(symbol);
	}

	return checker.getTypeOfSymbolAtLocation(symbol, symbol.declarations[0]);
}

/**
 * Get Kind of type
 * @param symbol
 */
export function getTypeKind(symbol: ts.Symbol)
{
	if (symbol.flags == ts.SymbolFlags.Class)
	{
		return TypeKind.Class;
	}

	if (symbol.flags == ts.SymbolFlags.Interface)
	{
		return TypeKind.Interface;
	}

	throw new Error("Unknown type kind");
}

/**
 * Get full name of type
 * @param type
 * @param typeSymbol
 */
export function getTypeFullName(type: ts.Type, typeSymbol?: ts.Symbol)
{
	typeSymbol = typeSymbol || type.getSymbol();

	if (!typeSymbol)
	{
		return undefined;
	}

	let filePath = typeSymbol.declarations[0].getSourceFile().fileName;

	if (rootDir)
	{
		filePath = path.join(path.relative(filePath, rootDir), path.basename(filePath));
	}

	return filePath + ":" + typeSymbol.getName()
}

/**
 * Check that Type is native type (string, number, boolean, ...)
 * @param type
 */
export function isNativeType(type: ts.Type): boolean
{
	return (type as any)["intrinsicName"] !== undefined;

	// const flag = type.getFlags();
	//
	// return [
	// 	ts.TypeFlags.String
	// ].includes(flag);
}

/**
 * Check that value is TS Expression
 * @param value
 */
export function isExpression(value: any)
{
	return value.hasOwnProperty("kind") && (value.constructor.name == "NodeObject" || value.constructor.name == "IdentifierObject");
}

/**
 * Check that function-like declaration has JSDoc with @reflectGeneric tag. If it has, store it in state of declaration.
 * @param fncType
 */
export function hasReflectJsDocWithStateStore(fncType: ts.Type): boolean
{
	const symbol = fncType.getSymbol();

	if (!symbol)
	{
		return false;
	}

	const jsdoc = symbol.getJsDocTags();

	// If declaration contains @reflectGeneric in JSDoc comment, pass all generic arguments
	if (jsdoc.some(tag => tag.name === REFLECT_GENERIC_DECORATOR))
	{
		// Here we know that it has reflect JSoc

		// Method/function declaration
		const declaration = fncType.symbol.declarations[0] as ts.FunctionLikeDeclarationBase;

		if (!declaration.typeParameters?.length)
		{
			return false;
		}

		const genericParams = declaration.typeParameters.map(p => p.name.escapedText.toString());
		const state: State = {
			usedGenericParameters: genericParams,
			indexesOfGenericParameters: genericParams.map((_, index) => index),
			declaredParametersCount: declaration.parameters.length,
			requestedGenericsReflection: true
		};

		// Store expecting types on original declaration node (cuz that node will be still visited until end of "before" phase, one of the node modifications take effect inside phase)
		(declaration as unknown as StateNode)[STATE_PROP] = state;

		return true;
	}

	return false;
}