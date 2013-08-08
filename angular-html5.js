/**
 * Add support for html5 tags & attributes in html4 browsers.
 *
 * Supported:
 *   <input placeholder="..." />
 *   <video />
 */

angular.module('html5', []);

 /**
  * Very simple placeholder support.
  */
angular.module('html5').directive('placeholder', function ($timeout) {
  	'use strict';
  	var input = document.createElement('input');
  	if ('placeholder' in input) {
		return {}; // Has native placeholder support
	}
	return {
		require: 'ngModel',
		link: function (scope, el, attrs, ngModel) {
			if (attrs.type === 'password') {
				return;
			}
			if (el.val() === '') {
				el.val(attrs.placeholder);
			}
			ngModel.$parsers.push(function(value) {
				if (value === attrs.placeholder) {
					return '';
				}
				return value;
			});
			$timeout(function(){
				el.val(attrs.placeholder).focus(function(){
					if (el.val() === attrs.placeholder) {
						el.val('');
					}
				}).blur(function(){
					if (el.val() === '') {
						el.val(attrs.placeholder);
					}
				});
			});
		}
	};
});

/**
 * <video> tag for mp4 playback using video.js (tested with v4.1)
 *
 * To start/stop the video from the controller use the h5-play attribute, which works similar to ng-show.
 * All video.js events are available through "on-*" attributes. Example: <video on-ended="trackView('watched video', $event)" />
 */
//document.createElement('video'); // for IE
angular.module('html5').directive('video', function($parse, $log) {
	'use strict';
	if (!videojs) {
		$log.warn('video.js not loaded');
		return {};
	}

	// @link https://github.com/videojs/video.js/blob/master/docs/api.md#event-types
	var events = [
		'loadstart',
		'loadedmetadata',
		'loadeddata',
		'loadedalldata',
		'play',
		'pause',
		'timeupdate',
		'ended',
		'durationchange',
		'progress',
		'resize',
		'volumechange',
		'error',
		'fullscreenchange'
	];
	return {
		restrict: 'E',
		scope: {
			src: '@',
			ngSrc: '@', // Override (buggy) ng-src behavior.
			poster: '@',
			h5Poster: '@', // Use h5-poster
			h5Play: '='
		},
		link: function ($scope, el, attrs) {
			// Check if the installed flash version is compatible with video.js (requires optional dependancy SWFObject)
			if (typeof swfobject !== 'undefined') {
				var version = swfobject.getFlashPlayerVersion();
				if (version.major < 11) {
					el.after('<div class="error-message">Sorry, no compatible source and playback technology were found for this video.<br />Try using another browser like <a href="http://bit.ly/ccMUEC">Chrome</a> or download the latest <a href="http://adobe.ly/mwfN1">Adobe Flash Player</a>.</div>');
					return;
				}
			}
			// Add video-js classes
			if (!attrs['class']) { // Only apply default skin if no class is defined.
				el.addClass('vjs-default-skin');
			}
			var correctAutoplay = angular.isDefined(attrs.autoplay);
			el.addClass('video-js');
			var options = {};
			if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
				options.techOrder = ["flash", "html5"]; // use flash fallback in firefox for mp4 playback.
			}
			/**
			 * Only call $scope.$apply() when a digest is NOT in progress.
			 */
			var safeApply = function () {
				if (!$scope.$root.$$phase) {
					$scope.$apply();
				}
			};
			$scope.$watch('h5Poster', function (url) {
				if (!url) {
					return;
				}
				attrs.$set('poster', url);
			});
			var player = false;
			videojs(el[0], options, function () {
				player = this;
				if ($scope.$$destroyed) { // video element is no longer needed?
					player = false;
					player.dispose();
					return;
				}
				// Update the placeholder image (poster)
				attrs.$observe('poster', function (url) {
					if (url) {
						el.children('.vjs-poster img').attr('src', '');
						player.poster(url);
					}
				});
				// Bind events to "on-*" attributes
				angular.forEach(events, function (event) {
					var method = attrs.$normalize('on-' + event);
					if (attrs[method]) {
						var fn = $parse(attrs[method]);
						player.on(event, function (e) {
							fn($scope.$parent, {$event: e});
							safeApply();
						});
					}
				});
				// Update the value bound to h5Play (Write binding).
				if (attrs.h5Play) {
					player.on('play', function () {
						$scope.h5Play = true;
						safeApply();
					});
					player.on('pause', function () {
						$scope.h5Play = false;
						safeApply();
					});
				}
				// Update the src
				angular.forEach(['src', 'ngSrc'], function (expression) {
					$scope.$watch(expression, function (url) {
						if (angular.isDefined(url)) {
							player.src(url);
							if ($scope.h5Play) {
								player.play();
							}
						}
					});
				});
				// Start/Stop the video with the h5-play value (Read binding)
				$scope.$watch('h5Play', function (value) {
					var shouldPlay = !!value;
					if (player.paused() == shouldPlay) {
						if (shouldPlay) {
							player.play();
						} else if (correctAutoplay) {
							correctAutoplay = false; // Prevent a pause-play loop.
						} else {
							player.pause();
						}
					}
				});
				safeApply();
			});

			// Clean up player
			$scope.$on('$destroy', function () {
				if (player) {
					player.dispose();
				}
			});
		}
	};
});
