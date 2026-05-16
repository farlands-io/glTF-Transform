import { Document, Logger, PlatformIO, Primitive, bbox } from "@gltf-transform/core";
import * as mat3 from "gl-matrix/mat3";
import * as mat4 from "gl-matrix/mat4";
import * as quat from "gl-matrix/quat";
import * as vec2 from "gl-matrix/vec2";
import * as vec3 from "gl-matrix/vec3";
import * as vec4 from "gl-matrix/vec4";

//#region src/create-basic-primitive.d.ts
/**
 * Creates a series of 'primCount' lines, forming an open-sided N-gon.
 *
 * Reference: https://glasnost.itcarlow.ie/~powerk/opengl/primitives/primitives.htm
 */
declare function createLineStripPrim(document: Document, primCount?: number): Primitive;
/**
 * Creates a series of 'primCount' lines, forming a closed N-gon.
 *
 * Reference: https://glasnost.itcarlow.ie/~powerk/opengl/primitives/primitives.htm
 */
declare function createLineLoopPrim(document: Document): Primitive;
/**
 * Creates an position vertex attribute array, containing `primCount` triangles,
 * arranged as a 1xN grid in the XZ plane.
 *
 * Reference: https://en.wikipedia.org/wiki/Triangle_strip
 */
declare function createTriangleStripPrim(document: Document, primCount?: number): Primitive;
/**
 * Creates a position vertex attribute array, containing `primCount` triangles,
 * arranged as a circular fan in the XZ plane.
 *
 * Reference: https://en.wikipedia.org/wiki/Triangle_fan
 */
declare function createTriangleFanPrim(document: Document, primCount?: number): Primitive;
//#endregion
//#region src/create-torus-primitive.d.ts
interface TorusKnotOptions {
  radius?: number;
  tube?: number;
  tubularSegments?: number;
  radialSegments?: number;
  p?: number;
  q?: number;
}
declare const TORUS_KNOT_DEFAULTS: Required<TorusKnotOptions>;
/** Based on THREE.TorusKnotGeometry. */
declare function createTorusKnotPrimitive(document: Document, options?: TorusKnotOptions): Primitive;
//#endregion
//#region src/index.d.ts
declare enum Environment {
  WEB = 0,
  DENO = 1,
  NODE = 2
}
declare const environment: Environment;
declare const logger: Logger;
declare const createPlatformIO: () => Promise<PlatformIO>;
declare function resolve(path: string, base: string): string;
/** Creates a rounding function for given decimal precision. */
declare function round(decimals?: number): (v: number) => number;
/** Rounds a 3D bounding box to given decimal precision. */
declare function roundBbox(bbox: bbox, decimals?: number): bbox;
//#endregion
export { Environment, TORUS_KNOT_DEFAULTS, TorusKnotOptions, createLineLoopPrim, createLineStripPrim, createPlatformIO, createTorusKnotPrimitive, createTriangleFanPrim, createTriangleStripPrim, environment, logger, mat3, mat4, quat, resolve, round, roundBbox, vec2, vec3, vec4 };