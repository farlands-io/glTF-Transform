import { ExtensionProperty, Primitive, PropertyType, Skin, uuid } from "@gltf-transform/core";
import { Bone, BufferAttribute, BufferGeometry, ClampToEdgeWrapping, DirectionalLight, DoubleSide, FrontSide, Group, InstancedMesh, Line, LineBasicMaterial, LineLoop, LineSegments, LinearFilter, LinearMipmapLinearFilter, LinearMipmapNearestFilter, Material as Material$1, Matrix4, Mesh as Mesh$1, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, MirroredRepeatWrapping, NearestFilter, NearestMipmapLinearFilter, NearestMipmapNearestFilter, NoColorSpace, Object3D, PointLight, Points, PointsMaterial, Quaternion, REVISION, RepeatWrapping, SRGBColorSpace, Skeleton, SkinnedMesh, SpotLight, Texture as Texture$1, Vector3, WebGLRenderer } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { Light } from "@gltf-transform/extensions";
//#region src/ImageProvider.ts
const TRANSCODER_PATH = `https://unpkg.com/three@0.${REVISION}.x/examples/jsm/libs/basis/`;
function createKTX2Loader() {
	const renderer = new WebGLRenderer();
	const loader = new KTX2Loader().detectSupport(renderer).setTranscoderPath(TRANSCODER_PATH);
	renderer.dispose();
	return loader;
}
/** Generates a Texture from a Data URI, or otherh URL. */
function createTexture(name, uri) {
	const imageEl = document.createElement("img");
	imageEl.src = uri;
	const texture = new Texture$1(imageEl);
	texture.name = name;
	texture.flipY = false;
	return texture;
}
const NULL_IMAGE_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAABNJREFUGFdj/M9w9z8DEmAkXQAAyCMLcU6pckIAAAAASUVORK5CYII=";
const LOADING_IMAGE_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII=";
var NullImageProvider = class {
	nullTexture = createTexture("__NULL_TEXTURE", NULL_IMAGE_URI);
	loadingTexture = createTexture("__LOADING_TEXTURE", LOADING_IMAGE_URI);
	async initTexture(_textureDef) {}
	async getTexture(_) {
		return this.nullTexture;
	}
	setKTX2Loader(_loader) {
		return this;
	}
	clear() {}
};
var DefaultImageProvider = class {
	nullTexture = createTexture("__NULL_TEXTURE", NULL_IMAGE_URI);
	loadingTexture = createTexture("__LOADING_TEXTURE", LOADING_IMAGE_URI);
	_cache = /* @__PURE__ */ new Map();
	_ktx2Loader = null;
	async initTexture(textureDef) {
		await this.getTexture(textureDef);
	}
	async getTexture(textureDef) {
		const image = textureDef.getImage();
		const mimeType = textureDef.getMimeType();
		let texture = this._cache.get(image);
		if (texture) return texture;
		texture = mimeType === "image/ktx2" ? await this._loadKTX2Image(image) : await this._loadImage(image, mimeType);
		this._cache.set(image, texture);
		return texture;
	}
	setKTX2Loader(loader) {
		this._ktx2Loader = loader;
		return this;
	}
	clear() {
		for (const [_, texture] of this._cache) texture.dispose();
		this._cache.clear();
	}
	dispose() {
		this.clear();
		if (this._ktx2Loader) this._ktx2Loader.dispose();
	}
	/** Load PNG, JPEG, or other browser-supported image format. */
	async _loadImage(image, mimeType) {
		return new Promise((resolve, reject) => {
			const blob = new Blob([image], { type: mimeType });
			const imageURL = URL.createObjectURL(blob);
			const imageEl = document.createElement("img");
			const texture = new Texture$1(imageEl);
			texture.flipY = false;
			imageEl.src = imageURL;
			imageEl.onload = () => {
				URL.revokeObjectURL(imageURL);
				resolve(texture);
			};
			imageEl.onerror = reject;
		});
	}
	/** Load KTX2 + Basis Universal compressed texture format. */
	async _loadKTX2Image(image) {
		this._ktx2Loader ||= createKTX2Loader();
		const blob = new Blob([image], { type: "image/ktx2" });
		const imageURL = URL.createObjectURL(blob);
		const texture = await this._ktx2Loader.loadAsync(imageURL);
		URL.revokeObjectURL(imageURL);
		return texture;
	}
};
//#endregion
//#region src/pools/Pool.ts
/**
* Pool of (optionally reusable) resources and resource variations.
*
* As Subjects publish many variations of the same values to Observers, it's important to
* allocate those variations efficiently, reuse instances where possible, and clean up unused
* instances. That bookkeeping is assigned to Pools (not a Reactive concept).
*
* @internal
*/
var Pool = class {
	name;
	documentView;
	_users = /* @__PURE__ */ new Map();
	constructor(name, documentView) {
		this.name = name;
		this.documentView = documentView;
	}
	_request(value) {
		let users = this._users.get(value) || 0;
		this._users.set(value, ++users);
		return value;
	}
	_release(value) {
		let users = this._users.get(value) || 0;
		this._users.set(value, --users);
		return value;
	}
	_disposeValue(value) {
		this._users.delete(value);
	}
	requestBase(base) {
		return this._request(base);
	}
	releaseBase(base) {
		this._release(base);
	}
	requestVariant(base, _params) {
		return this._request(base);
	}
	releaseVariant(variant) {
		this._release(variant);
	}
	gc() {
		for (const [value, users] of this._users) if (users <= 0) this._disposeValue(value);
	}
	size() {
		return this._users.size;
	}
	dispose() {
		for (const [value] of this._users) this._disposeValue(value);
		this._users.clear();
	}
};
//#endregion
//#region src/pools/MaterialPool.ts
/** @internal */
var MaterialPool = class extends Pool {
	static createParams(primitive) {
		return {
			mode: primitive.getMode(),
			useVertexTangents: !!primitive.getAttribute("TANGENT"),
			useVertexColors: !!primitive.getAttribute("COLOR_0"),
			useFlatShading: !primitive.getAttribute("NORMAL"),
			useMorphTargets: primitive.listTargets().length > 0
		};
	}
	requestVariant(srcMaterial, params) {
		return this._request(this._createVariant(srcMaterial, params));
	}
	_disposeValue(value) {
		value.dispose();
		super._disposeValue(value);
	}
	/** Creates a variant material for given source material and MaterialParams. */
	_createVariant(srcMaterial, params) {
		switch (params.mode) {
			case Primitive.Mode.TRIANGLES:
			case Primitive.Mode.TRIANGLE_FAN:
			case Primitive.Mode.TRIANGLE_STRIP: return this._updateVariant(srcMaterial, srcMaterial.clone(), params);
			case Primitive.Mode.LINES:
			case Primitive.Mode.LINE_LOOP:
			case Primitive.Mode.LINE_STRIP: return this._updateVariant(srcMaterial, new LineBasicMaterial(), params);
			case Primitive.Mode.POINTS: return this._updateVariant(srcMaterial, new PointsMaterial(), params);
			default: throw new Error(`Unexpected primitive mode: ${params.mode}`);
		}
	}
	/**
	* Updates a variant material to match new changes to the source material.
	*
	* NOTICE: Changes to MaterialParams should _NOT_ be applied with this method.
	* Instead, create a new variant and dispose the old if unused.
	*/
	_updateVariant(srcMaterial, dstMaterial, params) {
		if (srcMaterial.type === dstMaterial.type) dstMaterial.copy(srcMaterial);
		else if (dstMaterial instanceof LineBasicMaterial) {
			Material$1.prototype.copy.call(dstMaterial, srcMaterial);
			dstMaterial.color.copy(srcMaterial.color);
		} else if (dstMaterial instanceof PointsMaterial) {
			Material$1.prototype.copy.call(dstMaterial, srcMaterial);
			dstMaterial.color.copy(srcMaterial.color);
			dstMaterial.map = srcMaterial.map;
			dstMaterial.sizeAttenuation = false;
		}
		dstMaterial.vertexColors = params.useVertexColors;
		if (dstMaterial instanceof MeshStandardMaterial) {
			dstMaterial.flatShading = params.useFlatShading;
			dstMaterial.normalScale.y = params.useVertexTangents ? Math.abs(dstMaterial.normalScale.y) : -1 * dstMaterial.normalScale.y;
			if (dstMaterial instanceof MeshPhysicalMaterial) dstMaterial.clearcoatNormalScale.y = params.useVertexTangents ? Math.abs(dstMaterial.clearcoatNormalScale.y) : -1 * dstMaterial.clearcoatNormalScale.y;
		}
		if (dstMaterial.version < srcMaterial.version) dstMaterial.version = srcMaterial.version;
		return dstMaterial;
	}
};
//#endregion
//#region src/pools/SingleUserPool.ts
/** @internal */
var SingleUserPool = class extends Pool {
	static _parentIDs = /* @__PURE__ */ new WeakMap();
	/** Generates a unique Object3D for every parent. */
	static createParams(property) {
		const id = this._parentIDs.get(property) || uuid();
		this._parentIDs.set(property, id);
		return { id };
	}
	requestVariant(base, params) {
		return this._request(this._createVariant(base, params));
	}
	_createVariant(srcObject, _params) {
		const dstObject = srcObject.clone();
		if (dstObject instanceof SpotLight || dstObject instanceof DirectionalLight) {
			dstObject.clear();
			dstObject.add(dstObject.target);
		}
		parallelTraverse(srcObject, dstObject, (base, variant) => {
			if (base === srcObject) return;
			if (srcObject.isLight) return;
			this.documentView.recordOutputVariant(base, variant);
		});
		return dstObject;
	}
	_updateVariant(_srcObject, _dstObject) {
		throw new Error("Not implemented");
	}
};
function parallelTraverse(a, b, callback) {
	callback(a, b);
	for (let i = 0; i < a.children.length; i++) parallelTraverse(a.children[i], b.children[i], callback);
}
//#endregion
//#region src/pools/TexturePool.ts
const WEBGL_FILTERS = {
	9728: NearestFilter,
	9729: LinearFilter,
	9984: NearestMipmapNearestFilter,
	9985: LinearMipmapNearestFilter,
	9986: NearestMipmapLinearFilter,
	9987: LinearMipmapLinearFilter
};
const WEBGL_WRAPPINGS = {
	33071: ClampToEdgeWrapping,
	33648: MirroredRepeatWrapping,
	10497: RepeatWrapping
};
const _VEC2 = {
	ZERO: [0, 0],
	ONE: [1, 1]
};
/** @internal */
var TexturePool = class extends Pool {
	static createParams(textureInfo, colorSpace) {
		const transform = textureInfo.getExtension("KHR_texture_transform");
		return {
			colorSpace,
			channel: textureInfo.getTexCoord(),
			minFilter: WEBGL_FILTERS[textureInfo.getMinFilter()] || LinearMipmapLinearFilter,
			magFilter: WEBGL_FILTERS[textureInfo.getMagFilter()] || LinearFilter,
			wrapS: WEBGL_WRAPPINGS[textureInfo.getWrapS()] || RepeatWrapping,
			wrapT: WEBGL_WRAPPINGS[textureInfo.getWrapT()] || RepeatWrapping,
			offset: transform?.getOffset() || _VEC2.ZERO,
			rotation: transform?.getRotation() || 0,
			repeat: transform?.getScale() || _VEC2.ONE
		};
	}
	requestVariant(base, params) {
		return this._request(this._createVariant(base, params));
	}
	_disposeValue(value) {
		value.dispose();
		super._disposeValue(value);
	}
	_createVariant(srcTexture, params) {
		return this._updateVariant(srcTexture, srcTexture.clone(), params);
	}
	_updateVariant(srcTexture, dstTexture, params) {
		const needsUpdate = srcTexture.image !== dstTexture.image || dstTexture.colorSpace !== params.colorSpace || dstTexture.wrapS !== params.wrapS || dstTexture.wrapT !== params.wrapT;
		dstTexture.copy(srcTexture);
		dstTexture.colorSpace = params.colorSpace;
		dstTexture.channel = params.channel;
		dstTexture.minFilter = params.minFilter;
		dstTexture.magFilter = params.magFilter;
		dstTexture.wrapS = params.wrapS;
		dstTexture.wrapT = params.wrapT;
		dstTexture.offset.fromArray(params.offset || _VEC2.ZERO);
		dstTexture.rotation = params.rotation || 0;
		dstTexture.repeat.fromArray(params.repeat || _VEC2.ONE);
		if (needsUpdate) dstTexture.needsUpdate = true;
		return dstTexture;
	}
};
//#endregion
//#region src/subjects/Subject.ts
/**
* Implementation of BehaviorSubject pattern, emitting three.js objects when changes
* occur in glTF definitions.
*
* Each glTF definition (e.g. `Material`) is bound to a single Subject (e.g. `MaterialSubject`).
* The Subject is responsible for receiving change events published by the definition, generating a
* derived three.js object (e.g. `THREE.Material`), and publishing the new value to all Observers. More
* precisely, this is a [*BehaviorSubject*](https://reactivex.io/documentation/subject.html), which holds
* a single current value at any given time.
*
* @internal
*/
var Subject = class {
	def;
	value;
	pool;
	_documentView;
	_subscriptions = [];
	_outputs = /* @__PURE__ */ new Set();
	_outputParamsFns = /* @__PURE__ */ new Map();
	/**
	* Indicates that the output value of this subject is a singleton, and will not
	* be cloned by any observer. For some types (NodeSubject), declaring this can
	* avoid the need to republish after an in-place update to the value.
	*/
	_outputSingleton = false;
	constructor(documentView, def, value, pool) {
		this._documentView = documentView;
		this.def = def;
		this.value = value;
		this.pool = pool;
		const onChange = () => {
			const prevValue = this.value;
			this.update();
			if (this.value !== prevValue || !this._outputSingleton) this.publishAll();
		};
		const onDispose = () => this.dispose();
		def.addEventListener("change", onChange);
		def.addEventListener("dispose", onDispose);
		this._subscriptions.push(() => def.removeEventListener("change", onChange), () => def.removeEventListener("dispose", onDispose));
	}
	publishAll() {
		if (this._documentView.isDisposed()) return;
		for (const output of this._outputs) this.publish(output);
	}
	publish(output) {
		if (this._documentView.isDisposed()) return;
		if (output.value) this.pool.releaseVariant(output.value);
		const paramsFn = this._outputParamsFns.get(output);
		const value = this.pool.requestVariant(this.value, paramsFn());
		this._documentView.recordOutputValue(this.def, value);
		output.next(value);
	}
	dispose() {
		for (const unsub of this._subscriptions) unsub();
		if (this.value) this.pool.releaseBase(this.value);
		for (const output of this._outputs) {
			const value = output.value;
			output.detach();
			output.next(null);
			if (value) this.pool.releaseVariant(value);
		}
	}
	/**************************************************************************
	* Output API — Used by RefObserver.ts
	*/
	/**
	* Adds an output, which will receive future published values.
	* _Only for use of RefObserver.ts._
	*/
	addOutput(output, paramsFn) {
		this._outputs.add(output);
		this._outputParamsFns.set(output, paramsFn);
	}
	/**
	* Removes an output, which will no longer receive published values.
	* _Only for use of RefObserver.ts._
	*/
	removeOutput(output) {
		const value = output.value;
		this._outputs.delete(output);
		this._outputParamsFns.delete(output);
		if (value) this.pool.releaseVariant(value);
	}
};
//#endregion
//#region src/subjects/AccessorSubject.ts
/** @internal */
var AccessorSubject = class AccessorSubject extends Subject {
	constructor(documentView, def) {
		super(documentView, def, AccessorSubject.createValue(def, documentView.accessorPool), documentView.accessorPool);
	}
	static createValue(def, pool) {
		const array = def.getArray();
		return pool.requestBase(new BufferAttribute(array, def.getElementSize(), def.getNormalized()));
	}
	update() {
		const def = this.def;
		const value = this.value;
		if (def.getArray() !== value.array || def.getElementSize() !== value.itemSize || def.getNormalized() !== value.normalized) {
			this.pool.releaseBase(value);
			this.value = AccessorSubject.createValue(def, this.pool);
		} else value.needsUpdate = true;
	}
};
//#endregion
//#region src/subjects/ExtensionSubject.ts
/** @internal */
var ExtensionSubject = class extends Subject {
	constructor(documentView, def) {
		super(documentView, def, def, documentView.extensionPool);
	}
	update() {}
};
//#endregion
//#region src/utils/Observable.ts
var Observable = class {
	value;
	_subscriber = null;
	constructor(value) {
		this.value = value;
	}
	subscribe(subscriber) {
		if (this._subscriber) throw new Error("Observable: Limit one subscriber per Observable.");
		this._subscriber = subscriber;
		return () => this._subscriber = null;
	}
	next(value) {
		const prevValue = this.value;
		this.value = value;
		if (this._subscriber) this._subscriber(this.value, prevValue);
	}
	dispose() {
		this._subscriber = null;
	}
};
//#endregion
//#region src/utils/index.ts
function eq(a, b) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}
const DEFAULT_MATERIAL = new MeshStandardMaterial({
	name: "__DefaultMaterial",
	color: 16777215,
	roughness: 1,
	metalness: 1
});
function semanticToAttributeName(semantic) {
	switch (semantic) {
		case "POSITION": return "position";
		case "NORMAL": return "normal";
		case "TANGENT": return "tangent";
		case "COLOR_0": return "color";
		case "JOINTS_0": return "skinIndex";
		case "WEIGHTS_0": return "skinWeight";
		case "TEXCOORD_0": return "uv";
		case "TEXCOORD_1": return "uv1";
		case "TEXCOORD_2": return "uv2";
		case "TEXCOORD_3": return "uv3";
		default: return "_" + semantic.toLowerCase();
	}
}
//#endregion
//#region src/observers/RefObserver.ts
/**
* Observable connecting one Subject's output to another Subject's input.
*
* An Observer is subscribed to the values published by a particular Subject, and
* passes those events along to a parent — usually another Subject. For example, a MaterialSubject
* subscribes to updates from a TextureSubject using an Observer. Observers are parameterized:
* for example, a single Texture may be used by many Materials, with different offset/scale/encoding
* parameters in each. The TextureSubject treats each of these Observers as a different "output", and
* uses the parameters associated with the Observer to publish the appropriate value.
*
* RefObserver should let the Subject call .next(), generally avoiding calling .next() itself. The
* RefObserver is a passive pipe.
*
* @internal
*/
var RefObserver = class extends Observable {
	name;
	_subject = null;
	_subjectParamsFn = () => ({});
	_documentView;
	constructor(name, documentView) {
		super(null);
		this.name = name;
		this._documentView = documentView;
	}
	/**************************************************************************
	* Child interface. (Subject (Child))
	*/
	detach() {
		this._clear();
	}
	next(value) {
		if (this._documentView.isDisposed()) return;
		super.next(value);
	}
	/**************************************************************************
	* Parent interface. (Subject (Parent), ListObserver, MapObserver)
	*/
	setParamsFn(paramsFn) {
		this._subjectParamsFn = paramsFn;
		return this;
	}
	getDef() {
		return this._subject ? this._subject.def : null;
	}
	update(def) {
		const subject = def ? this._documentView.bind(def) : null;
		if (subject === this._subject) return;
		this._clear();
		if (subject) {
			this._subject = subject;
			this._subject.addOutput(this, this._subjectParamsFn);
			this._subject.publish(this);
		} else this.next(null);
	}
	/**
	* Forces the observed Subject to re-evaluate the output. For use when
	* output parameters are likely to have changed.
	*/
	invalidate() {
		if (this._subject) this._subject.publish(this);
	}
	dispose() {
		this._clear();
	}
	/**************************************************************************
	* Internal.
	*/
	_clear() {
		if (this._subject) {
			this._subject.removeOutput(this);
			this._subject = null;
		}
	}
};
//#endregion
//#region src/observers/RefListObserver.ts
/** @internal */
var RefListObserver = class extends Observable {
	name;
	_documentView;
	_observers = [];
	_subscriptions = [];
	constructor(name, documentView) {
		super([]);
		this.name = name;
		this._documentView = documentView;
	}
	update(defs) {
		const added = /* @__PURE__ */ new Set();
		const removed = /* @__PURE__ */ new Set();
		let needsUpdate = false;
		for (let i = 0; i < defs.length || i < this._observers.length; i++) {
			const def = defs[i];
			const observer = this._observers[i];
			if (!def) {
				removed.add(i);
				needsUpdate = true;
			} else if (!observer) {
				added.add(this._documentView.bind(def));
				needsUpdate = true;
			} else if (def !== observer.getDef()) {
				observer.update(def);
				needsUpdate = true;
			}
		}
		for (let i = this._observers.length; i >= 0; i--) if (removed.has(i)) this._remove(i);
		for (const add of added) this._add(add);
		if (needsUpdate) this._publish();
	}
	setParamsFn(paramsFn) {
		for (const observer of this._observers) observer.setParamsFn(paramsFn);
		return this;
	}
	_add(subject) {
		const observer = new RefObserver(this.name + "[]", this._documentView);
		observer.update(subject.def);
		this._observers.push(observer);
		this._subscriptions.push(observer.subscribe((next) => {
			if (!next) this._remove(this._observers.indexOf(observer));
			this._publish();
		}));
	}
	_remove(index) {
		const observer = this._observers[index];
		const unsub = this._subscriptions[index];
		unsub();
		observer.dispose();
		this._observers.splice(index, 1);
		this._subscriptions.splice(index, 1);
	}
	_publish() {
		this.next(this._observers.map((o) => o.value));
	}
	dispose() {
		for (const unsub of this._subscriptions) unsub();
		for (const observer of this._observers) observer.dispose();
		this._subscriptions.length = 0;
		this._observers.length = 0;
	}
};
//#endregion
//#region src/observers/RefMapObserver.ts
/** @internal */
var RefMapObserver = class extends Observable {
	name;
	_documentView;
	_observers = {};
	_subscriptions = {};
	constructor(name, documentView) {
		super({});
		this.name = name;
		this._documentView = documentView;
	}
	update(keys, defs) {
		const nextKeys = new Set(keys);
		const nextDefs = {};
		for (let i = 0; i < keys.length; i++) nextDefs[keys[i]] = defs[i];
		let needsUpdate = false;
		for (const key in this._observers) if (!nextKeys.has(key)) {
			this._remove(key);
			needsUpdate = true;
		}
		for (const key of keys) {
			const observer = this._observers[key];
			if (!observer) {
				this._add(key, this._documentView.bind(nextDefs[key]));
				needsUpdate = true;
			} else if (observer.getDef() !== nextDefs[key]) {
				observer.update(nextDefs[key]);
				needsUpdate = true;
			}
		}
		if (needsUpdate) this._publish();
	}
	setParamsFn(paramsFn) {
		for (const key in this._observers) this._observers[key].setParamsFn(paramsFn);
		return this;
	}
	_add(key, subject) {
		const observer = new RefObserver(this.name + `[${key}]`, this._documentView);
		observer.update(subject.def);
		this._observers[key] = observer;
		this._subscriptions[key] = observer.subscribe((next) => {
			if (!next) this._remove(key);
			this._publish();
		});
	}
	_remove(key) {
		const observer = this._observers[key];
		const unsub = this._subscriptions[key];
		unsub();
		observer.dispose();
		delete this._subscriptions[key];
		delete this._observers[key];
	}
	_publish() {
		const entries = Object.entries(this._observers).map(([key, observer]) => [key, observer.value]);
		this.next(Object.fromEntries(entries));
	}
	dispose() {
		for (const key in this._observers) {
			const observer = this._observers[key];
			const unsub = this._subscriptions[key];
			unsub();
			observer.dispose();
			delete this._subscriptions[key];
			delete this._observers[key];
		}
	}
};
//#endregion
//#region src/subjects/InstancedMeshSubject.ts
const _t = new Vector3();
const _r = new Quaternion();
const _s = new Vector3();
const _matrix = new Matrix4();
/** @internal */
var InstancedMeshSubject = class InstancedMeshSubject extends Subject {
	attributes = new RefMapObserver("attributes", this._documentView);
	constructor(documentView, def) {
		super(documentView, def, InstancedMeshSubject.createValue(getCount({}), documentView.instancedMeshPool), documentView.instancedMeshPool);
		this.attributes.subscribe((nextAttributes) => {
			let value = this.value;
			if (value) this.pool.releaseBase(value);
			value = InstancedMeshSubject.createValue(getCount(nextAttributes), documentView.instancedMeshPool);
			let translation = null;
			let rotation = null;
			let scale = null;
			for (const key in nextAttributes) if (key === "TRANSLATION") translation = nextAttributes[key];
			else if (key === "ROTATION") rotation = nextAttributes[key];
			else if (key === "SCALE") scale = nextAttributes[key];
			else value.geometry.setAttribute(semanticToAttributeName(key), nextAttributes[key]);
			_t.set(0, 0, 0);
			_r.set(0, 0, 0, 1);
			_s.set(1, 1, 1);
			for (let i = 0; i < value.count; i++) {
				if (translation) _t.fromBufferAttribute(translation, i);
				if (rotation) _r.fromBufferAttribute(rotation, i);
				if (scale) _s.fromBufferAttribute(scale, i);
				_matrix.compose(_t, _r, _s);
				value.setMatrixAt(i, _matrix);
			}
			this.value = value;
			this.publishAll();
		});
	}
	update() {
		const def = this.def;
		this.attributes.update(def.listSemantics(), def.listAttributes());
	}
	static createValue(count, pool) {
		return pool.requestBase(new InstancedMesh(new BufferGeometry(), DEFAULT_MATERIAL, count));
	}
	dispose() {
		this.value.geometry.dispose();
		this.attributes.dispose();
		super.dispose();
	}
};
function getCount(attributes) {
	for (const key in attributes) return attributes[key].count;
	return 1;
}
//#endregion
//#region src/subjects/LightSubject.ts
/** @internal */
var LightSubject = class LightSubject extends Subject {
	constructor(documentView, def) {
		super(documentView, def, LightSubject.createValue(def, documentView.lightPool), documentView.lightPool);
	}
	static createValue(def, pool) {
		switch (def.getType()) {
			case Light.Type.POINT: return pool.requestBase(new PointLight());
			case Light.Type.SPOT: return pool.requestBase(new SpotLight());
			case Light.Type.DIRECTIONAL: return pool.requestBase(new DirectionalLight());
			default: throw new Error(`Unexpected light type: ${def.getType()}`);
		}
	}
	update() {
		const def = this.def;
		let value = this.value;
		if (getType$1(def) !== value.type) {
			this.pool.releaseBase(value);
			this.value = value = LightSubject.createValue(def, this.pool);
		}
		value.name = def.getName();
		value.color.fromArray(def.getColor());
		value.intensity = def.getIntensity();
		value.position.set(0, 0, 0);
		if (value instanceof PointLight) {
			value.distance = def.getRange() || 0;
			value.decay = 2;
		} else if (value instanceof SpotLight) {
			value.distance = def.getRange() || 0;
			value.angle = def.getOuterConeAngle();
			value.penumbra = 1 - def.getInnerConeAngle() / def.getOuterConeAngle();
			value.decay = 2;
			value.target.position.set(0, 0, -1);
			value.add(value.target);
		} else if (value instanceof DirectionalLight) {
			value.target.position.set(0, 0, -1);
			value.add(value.target);
		}
	}
};
function getType$1(def) {
	switch (def.getType()) {
		case Light.Type.POINT: return "PointLight";
		case Light.Type.SPOT: return "SpotLight";
		case Light.Type.DIRECTIONAL: return "DirectionalLight";
		default: throw new Error(`Unexpected light type: ${def.getType()}`);
	}
}
//#endregion
//#region src/subjects/MaterialSubject.ts
const _vec3$1 = [
	0,
	0,
	0
];
var ShadingModel = /* @__PURE__ */ function(ShadingModel) {
	ShadingModel[ShadingModel["UNLIT"] = 0] = "UNLIT";
	ShadingModel[ShadingModel["STANDARD"] = 1] = "STANDARD";
	ShadingModel[ShadingModel["PHYSICAL"] = 2] = "PHYSICAL";
	return ShadingModel;
}(ShadingModel || {});
/** @internal */
var MaterialSubject = class MaterialSubject extends Subject {
	extensions = new RefListObserver("extensions", this._documentView);
	baseColorTexture = new RefObserver("baseColorTexture", this._documentView);
	emissiveTexture = new RefObserver("emissiveTexture", this._documentView);
	normalTexture = new RefObserver("normalTexture", this._documentView);
	occlusionTexture = new RefObserver("occlusionTexture", this._documentView);
	metallicRoughnessTexture = new RefObserver("metallicRoughnessTexture", this._documentView);
	anisotropyTexture = new RefObserver("anisotropyTexture", this._documentView);
	clearcoatTexture = new RefObserver("clearcoatTexture", this._documentView);
	clearcoatRoughnessTexture = new RefObserver("clearcoatRoughnessTexture", this._documentView);
	clearcoatNormalTexture = new RefObserver("clearcoatNormalTexture", this._documentView);
	iridescenceTexture = new RefObserver("iridescenceTexture", this._documentView);
	iridescenceThicknessTexture = new RefObserver("iridescenceThicknessTexture", this._documentView);
	sheenColorTexture = new RefObserver("sheenColorTexture", this._documentView);
	sheenRoughnessTexture = new RefObserver("sheenRoughnessTexture", this._documentView);
	specularTexture = new RefObserver("specularTexture", this._documentView);
	specularColorTexture = new RefObserver("specularColorTexture", this._documentView);
	transmissionTexture = new RefObserver("transmissionTexture", this._documentView);
	thicknessTexture = new RefObserver("thicknessTexture", this._documentView);
	_textureObservers = [];
	_textureUpdateFns = [];
	_textureApplyFns = [];
	constructor(documentView, def) {
		super(documentView, def, MaterialSubject.createValue(def, documentView.materialPool), documentView.materialPool);
		this.extensions.subscribe(() => {
			this.update();
			this.publishAll();
		});
		this.bindTexture(["map"], this.baseColorTexture, () => def.getBaseColorTexture(), () => def.getBaseColorTextureInfo(), SRGBColorSpace);
		this.bindTexture(["emissiveMap"], this.emissiveTexture, () => def.getEmissiveTexture(), () => def.getEmissiveTextureInfo(), SRGBColorSpace);
		this.bindTexture(["normalMap"], this.normalTexture, () => def.getNormalTexture(), () => def.getNormalTextureInfo(), NoColorSpace);
		this.bindTexture(["aoMap"], this.occlusionTexture, () => def.getOcclusionTexture(), () => def.getOcclusionTextureInfo(), NoColorSpace);
		this.bindTexture(["roughnessMap", "metalnessMap"], this.metallicRoughnessTexture, () => def.getMetallicRoughnessTexture(), () => def.getMetallicRoughnessTextureInfo(), NoColorSpace);
		const anisotropyExt = () => def.getExtension("KHR_materials_anisotropy");
		this.bindTexture(["anisotropyMap"], this.anisotropyTexture, () => anisotropyExt()?.getAnisotropyTexture() || null, () => anisotropyExt()?.getAnisotropyTextureInfo() || null, NoColorSpace);
		const clearcoatExt = () => def.getExtension("KHR_materials_clearcoat");
		this.bindTexture(["clearcoatMap"], this.clearcoatTexture, () => clearcoatExt()?.getClearcoatTexture() || null, () => clearcoatExt()?.getClearcoatTextureInfo() || null, NoColorSpace);
		this.bindTexture(["clearcoatRoughnessMap"], this.clearcoatRoughnessTexture, () => clearcoatExt()?.getClearcoatRoughnessTexture() || null, () => clearcoatExt()?.getClearcoatRoughnessTextureInfo() || null, NoColorSpace);
		this.bindTexture(["clearcoatNormalMap"], this.clearcoatNormalTexture, () => clearcoatExt()?.getClearcoatNormalTexture() || null, () => clearcoatExt()?.getClearcoatNormalTextureInfo() || null, NoColorSpace);
		const iridescenceExt = () => def.getExtension("KHR_materials_iridescence");
		this.bindTexture(["iridescenceTexture"], this.iridescenceTexture, () => iridescenceExt()?.getIridescenceTexture() || null, () => iridescenceExt()?.getIridescenceTextureInfo() || null, NoColorSpace);
		this.bindTexture(["iridescenceThicknessTexture"], this.iridescenceThicknessTexture, () => iridescenceExt()?.getIridescenceThicknessTexture() || null, () => iridescenceExt()?.getIridescenceThicknessTextureInfo() || null, NoColorSpace);
		const sheenExt = () => def.getExtension("KHR_materials_sheen");
		this.bindTexture(["sheenColorMap"], this.sheenColorTexture, () => sheenExt()?.getSheenColorTexture() || null, () => sheenExt()?.getSheenColorTextureInfo() || null, SRGBColorSpace);
		this.bindTexture(["sheenRoughnessMap"], this.sheenRoughnessTexture, () => sheenExt()?.getSheenRoughnessTexture() || null, () => sheenExt()?.getSheenRoughnessTextureInfo() || null, NoColorSpace);
		const specularExt = () => def.getExtension("KHR_materials_specular");
		this.bindTexture(["specularIntensityMap"], this.specularTexture, () => specularExt()?.getSpecularTexture() || null, () => specularExt()?.getSpecularTextureInfo() || null, NoColorSpace);
		this.bindTexture(["specularColorMap"], this.specularColorTexture, () => specularExt()?.getSpecularColorTexture() || null, () => specularExt()?.getSpecularColorTextureInfo() || null, SRGBColorSpace);
		const transmissionExt = () => def.getExtension("KHR_materials_transmission");
		this.bindTexture(["transmissionMap"], this.transmissionTexture, () => transmissionExt()?.getTransmissionTexture() || null, () => transmissionExt()?.getTransmissionTextureInfo() || null, NoColorSpace);
		const volumeExt = () => def.getExtension("KHR_materials_volume");
		this.bindTexture(["thicknessMap"], this.thicknessTexture, () => volumeExt()?.getThicknessTexture() || null, () => volumeExt()?.getThicknessTextureInfo() || null, NoColorSpace);
	}
	bindTexture(maps, observer, textureFn, textureInfoFn, colorSpace) {
		observer.setParamsFn(() => TexturePool.createParams(textureInfoFn(), colorSpace));
		const applyTextureFn = (texture) => {
			const material = this.value;
			for (const map of maps) {
				if (!(map in material)) continue;
				if (!!material[map] !== !!texture) material.needsUpdate = true;
				material[map] = texture;
			}
		};
		this._textureObservers.push(observer);
		this._textureUpdateFns.push(() => observer.update(textureFn()));
		this._textureApplyFns.push(() => applyTextureFn(observer.value));
		return observer.subscribe((texture) => {
			applyTextureFn(texture);
			this.publishAll();
		});
	}
	static createValue(def, pool) {
		switch (getShadingModel(def)) {
			case ShadingModel.UNLIT: return pool.requestBase(new MeshBasicMaterial());
			case ShadingModel.STANDARD: return pool.requestBase(new MeshStandardMaterial());
			case ShadingModel.PHYSICAL: return pool.requestBase(new MeshPhysicalMaterial());
			default: throw new Error("Unsupported shading model.");
		}
	}
	update() {
		const def = this.def;
		let value = this.value;
		this.extensions.update(def.listExtensions());
		const shadingModel = getShadingModel(def);
		if (shadingModel === ShadingModel.UNLIT && value.type !== "MeshBasicMaterial" || shadingModel === ShadingModel.STANDARD && value.type !== "MeshStandardMaterial" || shadingModel === ShadingModel.PHYSICAL && value.type !== "MeshPhysicalMaterial") {
			this.pool.releaseBase(this.value);
			this.value = MaterialSubject.createValue(def, this.pool);
			value = this.value;
			for (const fn of this._textureApplyFns) fn();
		}
		switch (shadingModel) {
			case ShadingModel.PHYSICAL: this._updatePhysical(value);
			case ShadingModel.STANDARD: this._updateStandard(value);
			default: this._updateBasic(value);
		}
		for (const fn of this._textureUpdateFns) fn();
	}
	_updateBasic(target) {
		const def = this.def;
		if (def.getName() !== target.name) target.name = def.getName();
		if (def.getDoubleSided() !== (target.side === DoubleSide)) target.side = def.getDoubleSided() ? DoubleSide : FrontSide;
		switch (def.getAlphaMode()) {
			case "OPAQUE":
				target.transparent = false;
				target.depthWrite = true;
				target.alphaTest = 0;
				break;
			case "BLEND":
				target.transparent = true;
				target.depthWrite = false;
				target.alphaTest = 0;
				break;
			case "MASK":
				target.transparent = false;
				target.depthWrite = true;
				target.alphaTest = def.getAlphaCutoff();
				break;
		}
		const alpha = def.getAlpha();
		if (alpha !== target.opacity) target.opacity = alpha;
		const baseColor = def.getBaseColorFactor().slice(0, 3);
		if (!eq(baseColor, target.color.toArray(_vec3$1))) target.color.fromArray(baseColor);
	}
	_updateStandard(target) {
		const def = this.def;
		const emissive = def.getEmissiveFactor();
		if (!eq(emissive, target.emissive.toArray(_vec3$1))) target.emissive.fromArray(emissive);
		const roughness = def.getRoughnessFactor();
		if (roughness !== target.roughness) target.roughness = roughness;
		const metalness = def.getMetallicFactor();
		if (metalness !== target.metalness) target.metalness = metalness;
		const occlusionStrength = def.getOcclusionStrength();
		if (occlusionStrength !== target.aoMapIntensity) target.aoMapIntensity = occlusionStrength;
		const normalScale = def.getNormalScale();
		if (normalScale !== target.normalScale.x) target.normalScale.setScalar(normalScale);
		const emissiveStrength = def.getExtension("KHR_materials_emissive_strength");
		if (emissiveStrength) {
			if (emissiveStrength.getEmissiveStrength() !== target.emissiveIntensity) target.emissiveIntensity = emissiveStrength.getEmissiveStrength();
		} else target.emissiveIntensity = 1;
	}
	_updatePhysical(target) {
		const def = this.def;
		if (!(target instanceof MeshPhysicalMaterial)) return;
		const anisotropy = def.getExtension("KHR_materials_anisotropy");
		if (anisotropy) {
			if (anisotropy.getAnisotropyStrength() !== target.anisotropy) {
				if (target.anisotropy === 0) target.needsUpdate = true;
				target.anisotropy = anisotropy.getAnisotropyStrength();
			}
			if (anisotropy.getAnisotropyRotation() !== target.anisotropyRotation) target.anisotropyRotation = anisotropy.getAnisotropyRotation();
		} else target.anisotropy = 0;
		const clearcoat = def.getExtension("KHR_materials_clearcoat");
		if (clearcoat) {
			if (clearcoat.getClearcoatFactor() !== target.clearcoat) {
				if (target.clearcoat === 0) target.needsUpdate = true;
				target.clearcoat = clearcoat.getClearcoatFactor();
			}
			if (clearcoat.getClearcoatRoughnessFactor() !== target.clearcoatRoughness) target.clearcoatRoughness = clearcoat.getClearcoatRoughnessFactor();
			if (clearcoat.getClearcoatNormalScale() !== target.clearcoatNormalScale.x) {
				target.clearcoatNormalScale.x = clearcoat.getClearcoatNormalScale();
				target.clearcoatNormalScale.y = -clearcoat.getClearcoatNormalScale();
			}
		} else target.clearcoat = 0;
		const ior = def.getExtension("KHR_materials_ior");
		if (ior) {
			if (ior.getIOR() !== target.ior) target.ior = ior.getIOR();
		} else target.ior = 1.5;
		const iridescence = def.getExtension("KHR_materials_iridescence");
		if (iridescence) {
			if (iridescence.getIridescenceFactor() !== target.iridescence) target.iridescence = iridescence.getIridescenceFactor();
			const range = [iridescence.getIridescenceThicknessMinimum(), iridescence.getIridescenceThicknessMaximum()];
			if (!eq(range, target.iridescenceThicknessRange)) {
				target.iridescenceThicknessRange[0] = range[0];
				target.iridescenceThicknessRange[1] = range[1];
			}
			if (iridescence.getIridescenceIOR() !== target.iridescenceIOR) target.iridescenceIOR = iridescence.getIridescenceIOR();
		} else target.iridescence = 0;
		const sheen = def.getExtension("KHR_materials_sheen");
		if (sheen) {
			target.sheen = 1;
			const sheenColor = sheen.getSheenColorFactor();
			if (!eq(sheenColor, target.sheenColor.toArray(_vec3$1))) target.sheenColor.fromArray(sheenColor);
			if (sheen.getSheenRoughnessFactor() !== target.sheenRoughness) target.sheenRoughness = sheen.getSheenRoughnessFactor();
		} else target.sheen = 0;
		const specular = def.getExtension("KHR_materials_specular");
		if (specular) {
			if (specular.getSpecularFactor() !== target.specularIntensity) target.specularIntensity = specular.getSpecularFactor();
			const specularColor = specular.getSpecularColorFactor();
			if (!eq(specularColor, target.specularColor.toArray(_vec3$1))) target.specularColor.fromArray(specularColor);
		} else {
			target.specularIntensity = 1;
			target.specularColor.setRGB(1, 1, 1);
		}
		const transmission = def.getExtension("KHR_materials_transmission");
		if (transmission) {
			if (transmission.getTransmissionFactor() !== target.transmission) {
				if (target.transmission === 0) target.needsUpdate = true;
				target.transmission = transmission.getTransmissionFactor();
			}
		} else target.transmission = 0;
		const volume = def.getExtension("KHR_materials_volume");
		if (volume) {
			if (volume.getThicknessFactor() !== target.thickness) {
				if (target.thickness === 0) target.needsUpdate = true;
				target.thickness = volume.getThicknessFactor();
			}
			if (volume.getAttenuationDistance() !== target.attenuationDistance) target.attenuationDistance = volume.getAttenuationDistance();
			const attenuationColor = volume.getAttenuationColor();
			if (!eq(attenuationColor, target.attenuationColor.toArray(_vec3$1))) target.attenuationColor.fromArray(attenuationColor);
		} else target.thickness = 0;
	}
	dispose() {
		this.extensions.dispose();
		for (const observer of this._textureObservers) observer.dispose();
		super.dispose();
	}
};
function getShadingModel(def) {
	for (const extension of def.listExtensions()) switch (extension.extensionName) {
		case "KHR_materials_unlit": return ShadingModel.UNLIT;
		case "KHR_materials_anisotropy":
		case "KHR_materials_clearcoat":
		case "KHR_materials_ior":
		case "KHR_materials_iridescence":
		case "KHR_materials_sheen":
		case "KHR_materials_specular":
		case "KHR_materials_transmission":
		case "KHR_materials_volume": return ShadingModel.PHYSICAL;
	}
	return ShadingModel.STANDARD;
}
//#endregion
//#region src/subjects/MeshSubject.ts
/** @internal */
var MeshSubject = class extends Subject {
	primitives = new RefListObserver("primitives", this._documentView).setParamsFn(() => SingleUserPool.createParams(this.def));
	constructor(documentView, def) {
		super(documentView, def, documentView.meshPool.requestBase(new Group()), documentView.meshPool);
		this.primitives.subscribe((nextPrims, prevPrims) => {
			if (prevPrims.length) this.value.remove(...prevPrims);
			if (nextPrims.length) this.value.add(...nextPrims);
			this.publishAll();
		});
	}
	update() {
		const def = this.def;
		const value = this.value;
		if (def.getName() !== value.name) value.name = def.getName();
		this.primitives.update(def.listPrimitives());
	}
	dispose() {
		this.primitives.dispose();
		super.dispose();
	}
};
//#endregion
//#region src/subjects/NodeSubject.ts
const _vec3 = [
	0,
	0,
	0
];
const _vec4 = [
	0,
	0,
	0,
	0
];
const IDENTITY = new Matrix4().identity();
/** @internal */
var NodeSubject = class extends Subject {
	children = new RefListObserver("children", this._documentView);
	mesh = new RefObserver("mesh", this._documentView).setParamsFn(() => SingleUserPool.createParams(this.def));
	skin = new RefObserver("skin", this._documentView);
	light = new RefObserver("light", this._documentView);
	instancedMesh = new RefObserver("instancedMesh", this._documentView);
	/** Output (Object3D) is never cloned by an observer. */
	_outputSingleton = true;
	constructor(documentView, def) {
		super(documentView, def, documentView.nodePool.requestBase(isJoint(def) ? new Bone() : new Object3D()), documentView.nodePool);
		this.children.subscribe((nextChildren, prevChildren) => {
			if (prevChildren.length) this.value.remove(...prevChildren);
			if (nextChildren.length) this.value.add(...nextChildren);
			this.publishAll();
		});
		this.mesh.subscribe(() => {
			this.detachMesh();
			this.attachMesh();
			this.bindSkeleton();
			this.publishAll();
		});
		this.skin.subscribe(() => {
			this.bindSkeleton();
			this.publishAll();
		});
		this.light.subscribe((nextLight, prevLight) => {
			if (prevLight) this.value.remove(prevLight);
			if (nextLight) this.value.add(nextLight);
			this.publishAll();
		});
		this.instancedMesh.subscribe(() => {
			this.detachMesh();
			this.attachMesh();
			this.publishAll();
		});
	}
	detachMesh() {
		let group;
		for (const child of this.value.children) if (child.isGroup) {
			group = child;
			break;
		}
		if (group) this.value.remove(group);
	}
	attachMesh() {
		const srcGroup = this.mesh.value;
		const srcInstancedMesh = this.instancedMesh.value;
		if (srcGroup && srcInstancedMesh) {
			const dstGroup = new Group();
			for (const mesh of srcGroup.children) {
				const instancedMesh = new InstancedMesh(mesh.geometry, mesh.material, srcInstancedMesh.count);
				instancedMesh.instanceMatrix.copy(srcInstancedMesh.instanceMatrix);
				dstGroup.add(instancedMesh);
			}
			this.value.add(dstGroup);
		} else if (srcGroup) this.value.add(srcGroup);
	}
	bindSkeleton() {
		if (!this.mesh.value || !this.skin.value) return;
		for (const prim of this.mesh.value.children) if (prim instanceof SkinnedMesh) {
			prim.bind(this.skin.value, IDENTITY);
			prim.normalizeSkinWeights();
		}
	}
	update() {
		const def = this.def;
		const value = this.value;
		if (def.getName() !== value.name) value.name = def.getName();
		if (!eq(def.getTranslation(), value.position.toArray(_vec3))) value.position.fromArray(def.getTranslation());
		if (!eq(def.getRotation(), value.quaternion.toArray(_vec4))) value.quaternion.fromArray(def.getRotation());
		if (!eq(def.getScale(), value.scale.toArray(_vec3))) value.scale.fromArray(def.getScale());
		this.children.update(def.listChildren());
		this.mesh.update(def.getMesh());
		this.skin.update(def.getSkin());
		this.light.update(def.getExtension("KHR_lights_punctual"));
		this.instancedMesh.update(def.getExtension("EXT_mesh_gpu_instancing"));
	}
	dispose() {
		this.children.dispose();
		this.mesh.dispose();
		this.skin.dispose();
		this.light.dispose();
		this.instancedMesh.dispose();
		super.dispose();
	}
};
function isJoint(def) {
	return def.listParents().some((parent) => parent instanceof Skin);
}
//#endregion
//#region src/subjects/PrimitiveSubject.ts
/** @internal */
var PrimitiveSubject = class PrimitiveSubject extends Subject {
	material = new RefObserver("material", this._documentView).setParamsFn(() => MaterialPool.createParams(this.def));
	indices = new RefObserver("indices", this._documentView);
	attributes = new RefMapObserver("attributes", this._documentView);
	constructor(documentView, def) {
		super(documentView, def, PrimitiveSubject.createValue(def, new BufferGeometry(), DEFAULT_MATERIAL, documentView.primitivePool), documentView.primitivePool);
		this.material.subscribe((material) => {
			if (this.value.material !== material) {
				this.value.material = material || DEFAULT_MATERIAL;
				this.publishAll();
			}
		});
		this.indices.subscribe((index) => {
			if (this.value.geometry.index !== index) {
				this.value.geometry.setIndex(index);
				this.publishAll();
			}
		});
		this.attributes.subscribe((nextAttributes, prevAttributes) => {
			const geometry = this.value.geometry;
			for (const key in prevAttributes) geometry.deleteAttribute(semanticToAttributeName(key));
			for (const key in nextAttributes) geometry.setAttribute(semanticToAttributeName(key), nextAttributes[key]);
			this.publishAll();
		});
	}
	update() {
		const def = this.def;
		let value = this.value;
		if (def.getName() !== value.name) value.name = def.getName();
		this.indices.update(def.getIndices());
		this.attributes.update(def.listSemantics(), def.listAttributes());
		this.material.update(def.getMaterial());
		if (getType(def) !== value.type) {
			this.pool.releaseBase(value);
			this.value = value = PrimitiveSubject.createValue(def, value.geometry, value.material, this.pool);
			this.material.invalidate();
		}
	}
	static createValue(def, geometry, material, pool) {
		switch (def.getMode()) {
			case Primitive.Mode.TRIANGLES:
			case Primitive.Mode.TRIANGLE_FAN:
			case Primitive.Mode.TRIANGLE_STRIP: if (geometry.hasAttribute("skinIndex")) return pool.requestBase(new SkinnedMesh(geometry, material));
			else return pool.requestBase(new Mesh$1(geometry, material));
			case Primitive.Mode.LINES: return pool.requestBase(new LineSegments(geometry, material));
			case Primitive.Mode.LINE_LOOP: return pool.requestBase(new LineLoop(geometry, material));
			case Primitive.Mode.LINE_STRIP: return pool.requestBase(new Line(geometry, material));
			case Primitive.Mode.POINTS: return pool.requestBase(new Points(geometry, material));
			default: throw new Error(`Unexpected primitive mode: ${def.getMode()}`);
		}
	}
	dispose() {
		this.value.geometry.dispose();
		this.material.dispose();
		this.indices.dispose();
		this.attributes.dispose();
		super.dispose();
	}
};
/** Returns equivalent GL mode enum for the given THREE.Object3D type. */
function getType(def) {
	switch (def.getMode()) {
		case Primitive.Mode.TRIANGLES:
		case Primitive.Mode.TRIANGLE_FAN:
		case Primitive.Mode.TRIANGLE_STRIP: if (def.getAttribute("JOINTS_0")) return "SkinnedMesh";
		else return "Mesh";
		case Primitive.Mode.LINES: return "LineSegments";
		case Primitive.Mode.LINE_LOOP: return "LineLoop";
		case Primitive.Mode.LINE_STRIP: return "Line";
		case Primitive.Mode.POINTS: return "Points";
		default: throw new Error(`Unexpected primitive mode: ${def.getMode()}`);
	}
}
//#endregion
//#region src/subjects/SceneSubject.ts
/** @internal */
var SceneSubject = class extends Subject {
	children = new RefListObserver("children", this._documentView);
	constructor(documentView, def) {
		super(documentView, def, documentView.scenePool.requestBase(new Group()), documentView.scenePool);
		this.children.subscribe((nextChildren, prevChildren) => {
			if (prevChildren.length) this.value.remove(...prevChildren);
			if (nextChildren.length) this.value.add(...nextChildren);
			this.publishAll();
		});
	}
	update() {
		const def = this.def;
		const target = this.value;
		if (def.getName() !== target.name) target.name = def.getName();
		this.children.update(def.listChildren());
	}
	dispose() {
		this.children.dispose();
		super.dispose();
	}
};
//#endregion
//#region src/subjects/SkinSubject.ts
/**
* SkinSubject transforms `nodeDef.skin` into a THREE.Skeleton instance. The upstream
* {@link NodeSubject} will bind the skeleton to the mesh, where {@link PrimitiveSubject}
* is responsible for emitting a THREE.SkinnedMesh if it contains skinning-related attributes.
*
* This subject does not guard against certain invalid states — missing bones, missing
* vertex weights — and should be used accordingly.
*
* @internal
*/
var SkinSubject = class SkinSubject extends Subject {
	joints = new RefListObserver("children", this._documentView);
	inverseBindMatrices = new RefObserver("inverseBindMatrices", this._documentView);
	/** Output (Skeleton) is never cloned by an observer. */
	_outputSingleton = true;
	constructor(documentView, def) {
		super(documentView, def, SkinSubject.createValue(def, [], null, documentView.skinPool), documentView.skinPool);
		this.joints.subscribe((joints) => {
			this.pool.releaseBase(this.value);
			this.value = SkinSubject.createValue(def, joints, this.inverseBindMatrices.value, this.pool);
			this.publishAll();
		});
		this.inverseBindMatrices.subscribe((inverseBindMatrices) => {
			this.pool.releaseBase(this.value);
			this.value = SkinSubject.createValue(def, this.joints.value, inverseBindMatrices, this.pool);
			this.publishAll();
		});
	}
	static createValue(_def, bones, ibm, pool) {
		const boneInverses = [];
		for (let i = 0; i < bones.length; i++) {
			const matrix = new Matrix4();
			if (ibm) matrix.fromArray(ibm.array, i * 16);
			boneInverses.push(matrix);
		}
		return pool.requestBase(new Skeleton(bones, boneInverses));
	}
	update() {
		this.joints.update(this.def.listJoints());
		this.inverseBindMatrices.update(this.def.getInverseBindMatrices());
	}
	dispose() {
		this.joints.dispose();
		this.inverseBindMatrices.dispose();
		super.dispose();
	}
};
//#endregion
//#region src/subjects/TextureSubject.ts
/** @internal */
var TextureSubject = class extends Subject {
	_image = null;
	constructor(documentView, def) {
		super(documentView, def, documentView.imageProvider.loadingTexture, documentView.texturePool);
	}
	update() {
		const def = this.def;
		const value = this.value;
		if (def.getName() !== value.name) value.name = def.getName();
		const image = def.getImage();
		if (image !== this._image) {
			this._image = image;
			if (this.value !== this._documentView.imageProvider.loadingTexture) this.pool.releaseBase(this.value);
			this._documentView.imageProvider.getTexture(def).then((texture) => {
				this.value = this.pool.requestBase(texture);
				this.publishAll();
			});
		}
	}
	dispose() {
		super.dispose();
	}
};
//#endregion
//#region src/DocumentViewImpl.ts
/** @internal */
var DocumentViewImpl = class {
	_disposed = false;
	_subjects = /* @__PURE__ */ new Map();
	_outputValues = /* @__PURE__ */ new WeakMap();
	_outputValuesInverse = /* @__PURE__ */ new WeakMap();
	accessorPool = new Pool("accessors", this);
	extensionPool = new Pool("extensions", this);
	materialPool = new MaterialPool("materials", this);
	instancedMeshPool = new Pool("instancedMeshes", this);
	lightPool = new SingleUserPool("lights", this);
	meshPool = new SingleUserPool("meshes", this);
	nodePool = new Pool("nodes", this);
	primitivePool = new SingleUserPool("primitives", this);
	scenePool = new Pool("scenes", this);
	skinPool = new Pool("skins", this);
	texturePool = new TexturePool("textures", this);
	imageProvider;
	constructor(config) {
		this.imageProvider = config.imageProvider || new DefaultImageProvider();
	}
	_addSubject(subject) {
		const def = subject.def;
		this._subjects.set(def, subject);
		def.addEventListener("dispose", () => {
			this._subjects.delete(def);
		});
	}
	bind(def) {
		if (!def) return null;
		if (this._subjects.has(def)) return this._subjects.get(def);
		let subject;
		switch (def.propertyType) {
			case PropertyType.ACCESSOR:
				subject = new AccessorSubject(this, def);
				break;
			case "InstancedMesh":
				subject = new InstancedMeshSubject(this, def);
				break;
			case "Light":
				subject = new LightSubject(this, def);
				break;
			case PropertyType.MATERIAL:
				subject = new MaterialSubject(this, def);
				break;
			case PropertyType.MESH:
				subject = new MeshSubject(this, def);
				break;
			case PropertyType.NODE:
				subject = new NodeSubject(this, def);
				break;
			case PropertyType.PRIMITIVE:
				subject = new PrimitiveSubject(this, def);
				break;
			case PropertyType.SCENE:
				subject = new SceneSubject(this, def);
				break;
			case PropertyType.SKIN:
				subject = new SkinSubject(this, def);
				break;
			case PropertyType.TEXTURE:
				subject = new TextureSubject(this, def);
				break;
			default: if (def instanceof ExtensionProperty) subject = new ExtensionSubject(this, def);
			else throw new Error(`Unimplemented type: ${def.propertyType}`);
		}
		subject.update();
		this._addSubject(subject);
		return subject;
	}
	recordOutputValue(def, value) {
		const outputValues = this._outputValues.get(def) || /* @__PURE__ */ new Set();
		outputValues.add(value);
		this._outputValues.set(def, outputValues);
		this._outputValuesInverse.set(value, def);
	}
	recordOutputVariant(base, variant) {
		const def = this._outputValuesInverse.get(base);
		if (def) this.recordOutputValue(def, variant);
		else console.warn(`Missing definition for output of type "${base.type}}"`);
	}
	stats() {
		return {
			accessors: this.accessorPool.size(),
			extensions: this.extensionPool.size(),
			instancedMeshes: this.instancedMeshPool.size(),
			lights: this.lightPool.size(),
			materials: this.materialPool.size(),
			meshes: this.meshPool.size(),
			nodes: this.nodePool.size(),
			primitives: this.primitivePool.size(),
			scenes: this.scenePool.size(),
			skins: this.skinPool.size(),
			textures: this.texturePool.size()
		};
	}
	gc() {
		this.accessorPool.gc();
		this.extensionPool.gc();
		this.instancedMeshPool.gc();
		this.lightPool.gc();
		this.materialPool.gc();
		this.meshPool.gc();
		this.nodePool.gc();
		this.primitivePool.gc();
		this.scenePool.gc();
		this.skinPool.gc();
		this.texturePool.gc();
	}
	findDef(target) {
		return this._outputValuesInverse.get(target) || null;
	}
	findValues(def) {
		return Array.from(this._outputValues.get(def) || []);
	}
	isDisposed() {
		return this._disposed;
	}
	dispose() {
		this._disposed = true;
		for (const [_, subject] of this._subjects) subject.dispose();
		this._subjects.clear();
		this.accessorPool.dispose();
		this.instancedMeshPool.dispose();
		this.lightPool.dispose();
		this.materialPool.dispose();
		this.meshPool.dispose();
		this.nodePool.dispose();
		this.primitivePool.dispose();
		this.skinPool.dispose();
		this.scenePool.dispose();
		this.texturePool.dispose();
	}
};
//#endregion
//#region src/DocumentView.ts
/**
* Constructs a three.js subtree from a glTF-Transform Document, and maintains a
* 1:1 mapping between every three.js/glTF object pair. Supports full and partial
* updates with significantly lower latency than serializing and reloading to
* THREE.GLTFLoader each time.
*/
var DocumentView = class {
	/** @internal */ _ready = false;
	/** @internal */ _document;
	/** @internal */ _impl;
	/** Constructs a new DocumentView. */
	constructor(document, config = {}) {
		this._document = document;
		this._impl = new DocumentViewImpl(config);
		this._ready = true;
	}
	view(def) {
		assert(this._ready);
		const value = this._impl.bind(def).value;
		this._impl.recordOutputValue(def, value);
		return value;
	}
	listViews(source) {
		assert(this._ready);
		return this._impl.findValues(source);
	}
	getProperty(view) {
		assert(this._ready);
		return this._impl.findDef(view);
	}
	stats() {
		assert(this._ready);
		return this._impl.stats();
	}
	gc() {
		assert(this._ready);
		this._impl.gc();
	}
	/**
	* Destroys the renderer and cleans up its resources.
	*
	* Lifecycle: For resources associated with...
	* - ...used Properties, dispose with renderer.
	* - ...unused Properties, dispose with renderer.
	* - ...disposed Properties, dispose immediately.
	*/
	dispose() {
		assert(this._ready);
		this._impl.dispose();
	}
};
function assert(ready) {
	if (!ready) throw new Error("DocumentView must be initialized before use.");
}
//#endregion
export { DocumentView, DefaultImageProvider as ImageProvider, NullImageProvider };
