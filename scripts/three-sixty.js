H5P.ThreeSixty = (function (EventDispatcher, THREE) {

  /**
   * The 360 degree panorama viewer with support for virtual reality.
   *
   * @class H5P.ThreeSixty
   * @extends H5P.EventDispatcher
   * @param {DOMElement} sourceElement video or image source
   * @param {number} ratio Display ratio of the viewport
   * @param {Function} [sourceNeedsUpdate] Determines if the source texture needs to be rerendered.
   */
  function ThreeSixty(sourceElement, ratio, sourceNeedsUpdate) {
    /** @alias H5P.ThreeSixty# */
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    // Settings
    var fieldOfView = 45;

    // Main wrapper element
    self.element = document.createElement('div');
    self.element.classList.add('h5p-three-sixty');

    /**
     * Help set up renderers and add them to the main wrapper element.
     *
     * @private
     * @param {THREE.Object3D|THREE.WebGLRenderer} renderer
     */
    var add = function (renderer) {
      renderer.domElement.classList.add('h5p-three-sixty-scene');
      self.element.appendChild(renderer.domElement);
      return renderer
    };

    // Create scene, add camera and a WebGL renderer
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(fieldOfView, ratio, 0.1, 1000);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = Math.PI/2;
    var renderer = add(new THREE.WebGLRenderer());

    // Create texture from source canvas
    var sourceTexture = new THREE.Texture(sourceElement, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter, THREE.RGBFormat);

    // Create a sphere surrounding the camera with the source texture
    var geometry = new THREE.SphereGeometry(50, 16, 12);
    var material = new THREE.MeshBasicMaterial({
      map: sourceTexture,
      side: THREE.FrontSide
    });

    var sphere = new THREE.Mesh(geometry, material);
    sphere.scale.x = -1; // Flip to make front side face inwards
    scene.add(sphere);

    // Create a scene for our "CSS world"
    var cssScene = new THREE.Scene();

    // Create a renderer for our "CSS world"
    var cssRenderer = add(new THREE.CSS3DRenderer());

    /**
     * Add element to "CSS world"
     * @param {DOMElement} element
     */
    self.add = function (element) {
      var threeElement = new THREE.CSS3DObject(element);

      element.style.left = 0;
      element.style.top = 0;

      /**
       * @private
       */
      var setElementPosition = function (yaw, pitch) {
        var radius = 500;

        threeElement.position.x = radius * Math.sin(yaw) * Math.cos(pitch);
        threeElement.position.y = radius * Math.sin(pitch);
        threeElement.position.z = -radius * Math.cos(yaw) * Math.cos(pitch);

        threeElement.rotation.order = 'YXZ';
        threeElement.rotation.y = -yaw;
        threeElement.rotation.x = pitch;
      };

      var elementControls = new PositionControls(element);
      elementControls.on('move', function (event) {
        setElementPosition(event.data.yaw, -event.data.pitch);
      });

      // Set initial position
      setElementPosition(0, 0);

      cssScene.add(threeElement);
      return threeElement;
    }

    /**
     * Remove element from "CSS world"
     * @param {THREE.CSS3DObject} threeElement
     */
    self.remove = function (threeElement) {
      cssScene.remove(threeElement);
    }

    /**
     * Give new size
     */
    self.resize = function () {
      if (!self.element.clientWidth) {
        return;
      }

      // Resize main wrapping element
      self.element.style.height = (self.element.clientWidth / ratio) + 'px';

      // Resize renderers
      renderer.setSize(self.element.clientWidth, self.element.clientHeight);
      cssRenderer.setSize(self.element.clientWidth, self.element.clientHeight);
    }

    /**
     * @private
     */
    var render = function () {

      if (sourceNeedsUpdate !== undefined && sourceNeedsUpdate(sourceElement)) {
        sourceTexture.needsUpdate = true;
      }

      // Draw scenes
      renderer.render(scene, camera);
      cssRenderer.render(cssScene, camera);

      // Prepare next render
      requestAnimationFrame(render);
    }

    // Add camera controls
    var cameraControls = new PositionControls(cssRenderer.domElement, 400, {yaw: camera.rotation.y, pitch: camera.rotation.x});
    cameraControls.on('move', function (event) {
      camera.rotation.y = event.data.yaw;
      camera.rotation.x = event.data.pitch;
    });
    cssRenderer.domElement.classList.add('h5p-three-sixty-controls');

    // Start rendering
    render();
  }

  // Extends the event dispatcher
  ThreeSixty.prototype = Object.create(EventDispatcher.prototype);
  ThreeSixty.prototype.constructor = ThreeSixty;

  /**
   * @param {THREE.Object3D} element
   */
  function PositionControls(element, mouseSpeed, startPosition) {
    /** @type PositionControls# */
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    // Settings
    if (!mouseSpeed) {
      mouseSpeed = 800; // Higher = slower
    }

    // Where the element is when it starts moving
    var fromPosition, currentPosition = {};

    // Set default start position
    if (!startPosition) {
      startPosition = {yaw: 0, pitch: 0};
    }

    /**
     * Handle mouse down
     *
     * @private
     * @param {MouseEvent} event
     */
    var downHandler = function (event) {
      if (event.which !== 1) {
        return; // Only react to left click
      }

      // Prevent other elements moving
      event.stopPropagation();

      // Set initial position
      fromPosition = {x: event.pageX, y: event.pageY};

      // Register mouse move and up handlers
      window.addEventListener('mousemove', moveHandler, false);
      window.addEventListener('mouseup', upHandler, false);
    }
    element.addEventListener('mousedown', downHandler, false);

    /**
     * Handle mouse move
     *
     * @private
     * @param {MouseEvent} event
     */
    var moveHandler = function (event) {
      // Update position relative to cursor speed
      currentPosition.yaw = startPosition.yaw + ((event.pageX - fromPosition.x) / mouseSpeed);
      currentPosition.pitch = startPosition.pitch + ((event.pageY - fromPosition.y) / mouseSpeed);

      // Max 90 degrees up and down on pitch
      var ninety = Math.PI / 2;
      if (currentPosition.pitch > ninety) {
        currentPosition.pitch = ninety;
      }
      else if (currentPosition.pitch < -ninety) {
        currentPosition.pitch = -ninety;
      }

      self.trigger('move', currentPosition);
    }

    /**
     * Handle mouse up
     *
     * @private
     * @param {MouseEvent} event
     */
    var upHandler = function (event) {
      // Keep track of the last position
      startPosition = {yaw: currentPosition.yaw, pitch: currentPosition.pitch};
      window.removeEventListener('mousemove', moveHandler, false);
      window.removeEventListener('mouseup', upHandler, false);
    }
  }

  return ThreeSixty;
})(H5P.EventDispatcher, H5P.ThreeJS);
