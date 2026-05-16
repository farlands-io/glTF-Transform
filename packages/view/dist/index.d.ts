import { Document, ExtensionProperty, Material, Mesh, Node, Primitive, Scene, Skin, Texture } from "@gltf-transform/core";
import { BufferAttribute, BufferGeometry, CompressedTexture, DirectionalLight, Group, InstancedMesh, Line, LineLoop, LineSegments, Material as Material$1, Mesh as Mesh$1, Object3D, PointLight, Points, Skeleton, SkinnedMesh, SpotLight, Texture as Texture$1 } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { Light } from "@gltf-transform/extensions";

//#region src/constants.d.ts
type MeshLike = Mesh$1<BufferGeometry, Material$1> | SkinnedMesh<BufferGeometry, Material$1> | Points<BufferGeometry, Material$1> | Line<BufferGeometry, Material$1> | LineSegments<BufferGeometry, Material$1> | LineLoop<BufferGeometry, Material$1>;
type LightLike = PointLight | SpotLight | DirectionalLight;
//#endregion
//#region src/ImageProvider.d.ts
interface ImageProvider {
  readonly nullTexture: Texture$1;
  readonly loadingTexture: Texture$1;
  initTexture(textureDef: Texture): Promise<void>;
  getTexture(textureDef: Texture): Promise<Texture$1 | CompressedTexture>;
  setKTX2Loader(loader: KTX2Loader): this;
  clear(): void;
}
declare class NullImageProvider implements ImageProvider {
  readonly nullTexture: Texture$1;
  readonly loadingTexture: Texture$1;
  initTexture(_textureDef: Texture): Promise<void>;
  getTexture(_: Texture): Promise<Texture$1 | CompressedTexture>;
  setKTX2Loader(_loader: KTX2Loader): this;
  clear(): void;
}
declare class DefaultImageProvider implements ImageProvider {
  readonly nullTexture: Texture$1;
  readonly loadingTexture: Texture$1;
  private _cache;
  private _ktx2Loader;
  initTexture(textureDef: Texture): Promise<void>;
  getTexture(textureDef: Texture): Promise<Texture$1 | CompressedTexture>;
  setKTX2Loader(loader: KTX2Loader): this;
  clear(): void;
  dispose(): void;
  /** Load PNG, JPEG, or other browser-supported image format. */
  private _loadImage;
  /** Load KTX2 + Basis Universal compressed texture format. */
  private _loadKTX2Image;
}
//#endregion
//#region src/DocumentViewImpl.d.ts
interface DocumentViewConfig {
  imageProvider?: ImageProvider;
}
//#endregion
//#region src/DocumentView.d.ts
/**
 * Constructs a three.js subtree from a glTF-Transform Document, and maintains a
 * 1:1 mapping between every three.js/glTF object pair. Supports full and partial
 * updates with significantly lower latency than serializing and reloading to
 * THREE.GLTFLoader each time.
 */
declare class DocumentView {
  /** Constructs a new DocumentView. */
  constructor(document: Document, config?: DocumentViewConfig);
  /**
   * For a given glTF-Transform Property definition, returns a corresponding
   * three.js view into the object. For example, given a glTF Transform scene,
   * returns a THREE.Group representing that scene. Repeated calls with the
   * same input will yield the same output objects.
   */
  view(def: Texture): Texture$1;
  view(def: Light): LightLike;
  view(def: Material): Material$1;
  view(def: Primitive): MeshLike;
  view(def: Mesh): Group;
  view(def: Node): Object3D;
  view(def: Scene): Group;
  /**
   * For a given source glTF-Transform Property definition, returns a list of rendered three.js
   * objects.
   */
  listViews(source: Texture): Texture$1[];
  listViews(source: Light): LightLike[];
  listViews(source: Material): Material$1[];
  listViews(source: Primitive): MeshLike[];
  listViews(source: Mesh): Group[];
  listViews(source: Node): Object3D[];
  listViews(source: Scene): Group[];
  /** For a given Object3D target, finds the source glTF-Transform Property definition. */
  getProperty(view: Texture$1): Texture | null;
  getProperty(view: LightLike): Light | null;
  getProperty(view: Material$1): Material | null;
  getProperty(view: MeshLike): Primitive | null;
  getProperty(view: Object3D): Mesh | Node | Scene | null;
  stats(): Record<string, number>;
  gc(): void;
  /**
   * Destroys the renderer and cleans up its resources.
   *
   * Lifecycle: For resources associated with...
   * - ...used Properties, dispose with renderer.
   * - ...unused Properties, dispose with renderer.
   * - ...disposed Properties, dispose immediately.
   */
  dispose(): void;
}
//#endregion
export { DocumentView, DefaultImageProvider as ImageProvider, NullImageProvider };