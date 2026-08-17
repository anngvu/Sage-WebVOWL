module.exports = AbstractTextElement;

function AbstractTextElement( container, backgroundColor ){
  var textBlock = container.append("text")
    .classed("text", true)
    .style("fill", this._getTextColor(backgroundColor))
    .attr("text-anchor", "middle");
  
  this._textBlock = function (){
    return textBlock;
  };
}

AbstractTextElement.prototype.LINE_DISTANCE = 1;
AbstractTextElement.prototype.CSS_CLASSES = {
  default: "text",
  subtext: "subtext",
  instanceCount: "instance-count"
};
AbstractTextElement.prototype.DARK_TEXT_COLOR = "#000";
AbstractTextElement.prototype.LIGHT_TEXT_COLOR = "#fff";

AbstractTextElement.prototype.translation = function ( x, y ){
  this._textBlock().attr("transform", "translate(" + x + ", " + y + ")");
  return this;
};

AbstractTextElement.prototype.remove = function (){
  this._textBlock().remove();
  return this;
};

AbstractTextElement.prototype._applyPreAndPostFix = function ( text, prefix, postfix ){
  if ( prefix ) {
    text = prefix + text;
  }
  if ( postfix ) {
    text += postfix;
  }
  return text;
};

AbstractTextElement.prototype._getTextColor = function ( rawBackgroundColor ){
  if ( !rawBackgroundColor ) {
    return AbstractTextElement.prototype.DARK_TEXT_COLOR;
  }

  // Pick whichever ink actually contrasts better against the fill. A plain
  // luminance threshold gets mid-tone fills wrong -- it puts white on
  // mid-greens at ~2.8:1, well under the 4.5:1 needed to stay readable.
  var backgroundColor = d3.rgb(rawBackgroundColor);
  var darkRatio = contrastRatio(backgroundColor, d3.rgb(AbstractTextElement.prototype.DARK_TEXT_COLOR));
  var lightRatio = contrastRatio(backgroundColor, d3.rgb(AbstractTextElement.prototype.LIGHT_TEXT_COLOR));

  if ( darkRatio >= lightRatio ) {
    return AbstractTextElement.prototype.DARK_TEXT_COLOR;
  } else {
    return AbstractTextElement.prototype.LIGHT_TEXT_COLOR;
  }
};

/** WCAG 2.1 relative luminance. */
function calculateLuminance( color ){
  function channel( value ){
    var srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  }

  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** WCAG 2.1 contrast ratio, 1:1 (identical) to 21:1 (black on white). */
function contrastRatio( colorA, colorB ){
  var a = calculateLuminance(colorA),
    b = calculateLuminance(colorB),
    lighter = Math.max(a, b),
    darker = Math.min(a, b);

  return (lighter + 0.05) / (darker + 0.05);
}
