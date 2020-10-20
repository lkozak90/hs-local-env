$(document).ready(function () {
	iOS();
	if (/MSIE 9/i.test(navigator.userAgent) || /rv:11.0/i.test(navigator.userAgent) || /MSIE 10/i.test(navigator.userAgent) || /Edge\/12./i.test(navigator.userAgent) || window.navigator.userAgent.indexOf("Edge") > -1) {
		$('body').addClass('ms-browser');
	}
})

function iOS() {
	var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
	if (iOS) $('body').addClass('ios');
}

if(/MSIE 9/i.test(navigator.userAgent) || /rv:11.0/i.test(navigator.userAgent) || /MSIE 10/i.test(navigator.userAgent) ||/Edge\/12./i.test(navigator.userAgent) || window.navigator.userAgent.indexOf("Edge") > -1 ){
	$('body').addClass('ms-browser');
}
if(navigator.userAgent.toLowerCase().indexOf('firefox') > -1){
	$('body').addClass('ff');
}

if(navigator.userAgent.indexOf('Chrome') > -1) {
	$('body').addClass('chrome');
}

if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
	$('body').addClass('touch-device');
}

if (!!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/) ) {
	$('body').addClass('safari');
} 