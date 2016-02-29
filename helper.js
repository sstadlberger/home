var ltx = {};

ltx.getElement = function (element, path) {
	var current = path.shift();
	var result = element.getChild(current);
	if (result && path.length > 0) {
		result = this.getElement(result, path);
	}
	return result;
}

ltx.getElements = function (element, path) {
	var result;
	var current = path.shift();
	
	if (path.length == 0 && element.getChildren(current)) {
		result = element.getChildren(current);
	} else {
		result = element.getChild(current);
		if (result && path.length > 0) {
			result = this.getElements(result, path);
		}
	}
	if (!result) {
		result = [];
	}

	return result;
}

ltx.getAttr = function (object, attribute) {
	var result;
	if (object && object.attrs && object.attrs[attribute]) {
		result = object.attrs[attribute];
	}
	return result;
}

ltx.getElementAttr = function (element, path, attribute) {
	return this.getAttr(this.getElement(element, path), attribute);
}

ltx.getText = function (object) {
	var result;
	if (object && object.text()) {
		result = object.text();
	}
	return result;
}

ltx.getElementText = function (element, path) {
	return this.getText(this.getElement(element, path));
}

module.exports.ltx = ltx;