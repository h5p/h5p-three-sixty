H5P.ThreeSixty = (function (EventDispatcher, THREE) {

  /**
   * Convert deg to rad
   * @return {number}
   */
  var toRad = function (value) {
    return value * (Math.PI / 180);
  };

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
    var fieldOfView = 75;

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
      return renderer;
    };

    // Create scene, add camera and a WebGL renderer
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(fieldOfView, ratio, 0.1, 1000);
    camera.rotation.order = 'YXZ';

    var renderer = add(new THREE.WebGLRenderer());

    // Create texture from source canvas
    var sourceTexture = new THREE.Texture(sourceElement, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter, THREE.RGBFormat);

    // Create a sphere surrounding the camera with the source texture
    var geometry = new THREE.SphereGeometry(500, 60, 40);
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

    self.startRendering = function () {
      self.isRendering = true;
      render();
    };

    self.stopRendering = function () {
      self.isRendering = false;
    };

    /**
     * Add element to "CSS 3d world"
     *
     * @param {DOMElement} element
     * @param {Object} startPosition
     * @param {boolean} enableControls
     */
    self.add = function (element, startPosition, enableControls) {
      var threeElement = new THREE.CSS3DObject(element);

      // Reset HUD values
      element.style.left = 0;
      element.style.top = 0;

      /**
       * Set the element's position in the 3d world, always facing the camera.
       *
       * @private
       * @param {number} yaw Radians from 0 to Math.PI*2 (0-360)
       * @param {number} pitch Radians from -Math.PI/2 to Math.PI/2 (-90-90)
       */
      var setElementPosition = function (yaw, pitch) {
        var radius = 800;

        threeElement.position.x = radius * Math.sin(yaw) * Math.cos(pitch);
        threeElement.position.y = radius * Math.sin(pitch);
        threeElement.position.z = -radius * Math.cos(yaw) * Math.cos(pitch);

        threeElement.rotation.order = 'YXZ';
        threeElement.rotation.y = -yaw;
        threeElement.rotation.x = pitch;
      };

      if (enableControls) {
        var elementControls = new PositionControls(element);

        // Relay and supplement startMoving event
        elementControls.on('movestart', function (event) {
          // Set camera start position
          elementControls.startY = -threeElement.rotation.y;
          elementControls.startX = threeElement.rotation.x;

          preventDeviceOrientation = true;
          event.data = {element: element};
          self.trigger(event);
        });

        // Update element position according to movement
        elementControls.on('move', function (event) {
          setElementPosition(elementControls.startY + event.alphaDelta, elementControls.startX - event.betaDelta);
        });

        // Relay and supplement stopMoving event
        elementControls.on('movestop', function (event) {
          event.data = {
            yaw: -threeElement.rotation.y,
            pitch: threeElement.rotation.x
          };
          console.log(event.data);
          preventDeviceOrientation = false;
          self.trigger(event);
        });
      }

      // Set initial position
      setElementPosition(startPosition.yaw, startPosition.pitch);

      cssScene.add(threeElement);
      return threeElement;
    };

    /**
     * Remove element from "CSS world"
     * @param {THREE.CSS3DObject} threeElement
     */
    self.remove = function (threeElement) {
      cssScene.remove(threeElement);
    };

    /**
     * Get the position the camera is currently pointing at
     *
     * @return {Object}
     */
    self.getCurrentPosition = function () {
      return {
        yaw: -camera.rotation.y,
        pitch: camera.rotation.x
      };
    };

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
    };

    var hasFirstRender;

    /**
     * @private
     */
    var render = function () {
      if (!self.isRendering) {
        return;
      }

      if (!hasFirstRender || sourceNeedsUpdate !== undefined && sourceNeedsUpdate(sourceElement)) {
        hasFirstRender = true;
        sourceTexture.needsUpdate = true;
      }

      // Draw scenes
      renderer.render(scene, camera);
      cssRenderer.render(cssScene, camera);

      // Prepare next render
      requestAnimationFrame(render);
    };

    // Add camera controls
    var cameraControls = new PositionControls(cssRenderer.domElement, 400);

    // Camera starts moving handler
    cameraControls.on('movestart', function (event) {
      // Set camera start position
      cameraControls.startY = camera.rotation.y;
      cameraControls.startX = camera.rotation.x;

      preventDeviceOrientation = true;

      // Relay event
      self.trigger(event);
    });

    // Rotate camera as controls move
    cameraControls.on('move', function (event) {
      camera.rotation.y = cameraControls.startY + event.alphaDelta;
      camera.rotation.x = cameraControls.startX + event.betaDelta;
    });

    // Relay camera movement stopped event
    cameraControls.on('movestop', function (event) {
      preventDeviceOrientation = false;
      self.trigger(event);
    });

    // Add approperiate styling
    cssRenderer.domElement.classList.add('h5p-three-sixty-controls');

    var preventDeviceOrientation;
    var qOrientation, qMovement, qNinety, euler, xVector, zVector;

    /**
     * Handle screen orientation change by compensating camera
     *
     * @private
     */
    var setOrientation = function () {
      qOrientation.setFromAxisAngle(zVector, toRad(-(window.orientation || 0)));
    };

    /**
     * Initialize orientation supported device
     *
     * @private
     */
    var initializeOrientation = function () {
      qOrientation = new THREE.Quaternion();
      qMovement = new THREE.Quaternion();
      qNinety = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
      euler = new THREE.Euler();
      xVector = new THREE.Vector3(1, 0, 0);
      zVector = new THREE.Vector3(0, 0, 1);

      // Listen for screen rotation
      window.addEventListener('orientationchange', setOrientation, false);
      setOrientation(); // Set default
    };

    /**
     * Handle device groscope movement
     *
     * @param {DeviceOrientationEvent} event
     */
    var deviceOrientation = function (event) {
      if (qOrientation === undefined) {
        // Initialize on first orientation event
        initializeOrientation();
      }

      if (preventDeviceOrientation) {
        return;
      }

      // Adjust camera to reflect device movement
      euler.set(toRad(event.beta), toRad(event.alpha) + cameraControls.getAlpha(), toRad(-event.gamma), 'YXZ');
      camera.quaternion.setFromEuler(euler);
      camera.quaternion.multiply(qNinety); // Shift camera 90 degrees
      qMovement.setFromAxisAngle(xVector, -cameraControls.getBeta());
      camera.quaternion.multiply(qMovement); // Compensate for movement
      camera.quaternion.multiply(qOrientation); // Compensate for device orientation
    };

    // Add device orientation controls
    window.addEventListener('deviceorientation', deviceOrientation, false);
  }

  // Extends the event dispatcher
  ThreeSixty.prototype = Object.create(EventDispatcher.prototype);
  ThreeSixty.prototype.constructor = ThreeSixty;

  /**
   * Class for manipulating element position using different controls.
   *
   * @class
   * @param {THREE.Object3D} element
   * @param {number} [friction] Determines the speed of the movement
   */
  function PositionControls(element, friction) {
    /** @type PositionControls# */
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    // Set default parameters
    if (!friction) {
      friction = 800; // Higher = slower
    }

    var alpha = 0; // From 0 to 2pi
    var beta = 0; // From -pi/2 to pi/2

    var controlActive; // Determine if a control is being used

    var startPosition; // Where the element is when it starts moving
    var startAlpha; // Holds initial alpha value while control is active
    var startBeta; // Holds initial beta value while control is active

    /**
     * Generic initialization when movement starts.
     *
     * @private
     * @param {number} x Initial x coordinate
     * @param {number} y Initial y coordinate
     * @return {boolean} If it's safe to start moving
     */
    var start = function (x, y) {
      if (controlActive) {
        return false; // Another control is active
      }

      // Trigger an event when we start moving, and give other components
      // a chance to cancel
      var movestartEvent = new H5P.Event('movestart');
      movestartEvent.defaultPrevented = false;

      self.trigger(movestartEvent);
      if (movestartEvent.defaultPrevented) {
        return false; // Another component doesn't want us to start moving
      }

      // Set initial position
      startPosition = {
        x: x,
        y: y
      };
      startAlpha = alpha;
      startBeta = beta;

      controlActive = true;
      return true;
    };

    /**
     * Generic movement handler
     *
     * @private
     * @param {number} x Current x coordinate
     * @param {number} y Current y coordinate
     * @param {number} f Current friction
     */
    var move = function (x, y, f) {
      // Prepare move event
      var moveEvent = new H5P.Event('move');

      // Update position relative to cursor speed
      moveEvent.alphaDelta = (x - startPosition.x) / f;
      moveEvent.betaDelta = (y - startPosition.y) / f;
      alpha = (startAlpha + moveEvent.alphaDelta) % (Math.PI * 2); // Max 360
      beta = (startBeta - moveEvent.betaDelta) % Math.PI; // Max 180

      // Max 90 degrees up and down on pitch  TODO: test
      var ninety = Math.PI / 2;
      if (beta > ninety) {
        beta = ninety;
      }
      else if (beta < -ninety) {
        beta = -ninety;
      }

      moveEvent.alpha = alpha;
      moveEvent.beta = beta;

      // Trigger move event
      self.trigger(moveEvent);
    };

    /**
     * Generic deinitialization when movement stops.
     *
     * @private
     */
    var end = function () {
      controlActive = false;
      self.trigger('movestop');
    };

    /**
     * Handle mouse down
     *
     * @private
     * @param {MouseEvent} event
     */
    var mouseDown = function (event) {
      if (event.which !== 1) {
        return; // Only react to left click
      }

      if (!start(event.pageX, event.pageY)) {
        return; // Prevented by another component
      }

      // Prevent other elements from moving
      event.stopPropagation();

      // Register mouse move and up handlers
      window.addEventListener('mousemove', mouseMove, false);
      window.addEventListener('mouseup', mouseUp, false);

    };

    /**
     * Handle mouse move
     *
     * @private
     * @param {MouseEvent} event
     */
    var mouseMove = function (event) {
      move(event.pageX, event.pageY, friction);
    };

    /**
     * Handle mouse up
     *
     * @private
     * @param {MouseEvent} event
     */
    var mouseUp = function (event) {
      window.removeEventListener('mousemove', mouseMove, false);
      window.removeEventListener('mouseup', mouseUp, false);
      end();
    };

    /**
     * Handle touch start
     *
     * @private
     * @param {TouchEvent} event
     */
    var touchStart = function (event) {
      if (!start(event.changedTouches[0].pageX, event.changedTouches[0].pageY)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      element.addEventListener('touchmove', touchMove, false);
      element.addEventListener('touchend', touchEnd, false);
    };

    /**
     * Handle touch movement
     *
     * @private
     * @param {TouchEvent} event
     */
    var touchMove = function (event) {
      move(event.changedTouches[0].pageX, event.changedTouches[0].pageY, friction * 0.75);
    };

    /**
     * Handle touch end
     *
     * @private
     * @param {TouchEvent} event
     */
    var touchEnd = function (event) {
      element.removeEventListener('touchmove', touchMove, false);
      element.removeEventListener('touchend', touchEnd, false);
      end();
    };

    /**
     * @return {number}
     */
    self.getAlpha = function () {
      return alpha;
    };

    /**
     * @return {number}
     */
    self.getBeta = function () {
      return beta;
    };

    /**
     * @return {boolean}
     */
    self.isMoving = function () {
      return !!controlActive;
    };

    // Register event listeners to position element
    element.addEventListener('mousedown', mouseDown, false);
    element.addEventListener('touchstart', touchStart, false);
  }

  return ThreeSixty;
})(H5P.EventDispatcher, H5P.ThreeJS);
