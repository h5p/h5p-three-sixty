H5P.ThreeSixty = (function (EventDispatcher, THREE) {

  /**
   * The 360 degree panorama viewer with support for virtual reality.
   *
   * @class H5P.ThreeSixty
   * @extends H5P.EventDispatcher
   * @param {DOMElement} sourceElement video or image source
   * @param {Object} sourceSize Actualy size of the media displayed
   * @param {Object} viewSize Size of the viewport
   * @param {Function} [sourceNeedsUpdate] Determines if the source texture needs to be rerendered.
   */
  function ThreeSixty(sourceElement, sourceSize, viewSize, sourceNeedsUpdate) {
    /** @alias H5P.ThreeSixty# */
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    // Settings
    var fieldOfView = 45;
    var mouseSpeed = 300; // Higher = slow

    // Create scene, add camera and a WebGL renderer
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(fieldOfView, viewSize.width / viewSize.height, 0.1, 1000);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = Math.PI/2;
    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(viewSize.width, viewSize.height);

    // Make main canvas element public
    self.element = renderer.domElement;

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

    // Start position and last position for rotating the sphere
    var startPos, lastPos = {x: camera.rotation.y, y: camera.rotation.x};

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

      // Set initial position
      startPos = {x: event.pageX, y: event.pageY};

      // Register mouse move and up handlers
      window.addEventListener('mousemove', moveHandler, false);
      window.addEventListener('mouseup', upHandler, false);
    }

    /**
     * Handle mouse move
     *
     * @private
     * @param {MouseEvent} event
     */
    var moveHandler = function (event) {
      // Update camera rotation
      camera.rotation.x = lastPos.y + ((event.pageY - startPos.y) / mouseSpeed);
      camera.rotation.y = lastPos.x + ((event.pageX - startPos.x) / mouseSpeed);

      // Max 90 degrees for up and down
      var ninety = Math.PI / 2;
      if (camera.rotation.x > ninety) {
        camera.rotation.x = ninety;
      }
      else if (camera.rotation.x < -ninety) {
        camera.rotation.x = -ninety;
      }
    }

    /**
     * Handle mouse up
     *
     * @private
     * @param {MouseEvent} event
     */
    var upHandler = function (event) {
      // Keep track of the last position
      lastPos = {x: camera.rotation.y, y: camera.rotation.x};
      window.removeEventListener('mousemove', moveHandler, false);
      window.removeEventListener('mouseup', upHandler, false);
    }


    //CSS3D Scene
    var cssScene = new THREE.Scene();

    //HTML
    var element = document.createElement('div');
    element.innerHTML = 'Can has DIV';
    element.className = 'three-div';

    element.style.color = 'pink';
    element.style.background = 'black';
    element.style.borderRadius = '1em';
    element.style.padding = '0.5em 1em';

    //CSS Object
    var div = new THREE.CSS3DObject(element);
    div.position.x = 0;
    div.position.y = 0;
    div.position.z = -500;
    cssScene.add(div);

    //CSS3D Renderer
    var cssRenderer = new THREE.CSS3DRenderer();
    cssRenderer.setSize(viewSize.width, viewSize.height);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.top = 0;
    self.cssElement = cssRenderer.domElement

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

    // Register mousedown handler
    self.cssElement.addEventListener('mousedown', downHandler, false);
    self.cssElement.classList.add('h5p-three-sixty-controls');

    // Start rendering
    render();
  }

  // Extends the event dispatcher
  ThreeSixty.prototype = Object.create(EventDispatcher.prototype);
  ThreeSixty.prototype.constructor = ThreeSixty;

  return ThreeSixty;
})(H5P.EventDispatcher, H5P.ThreeJS);
