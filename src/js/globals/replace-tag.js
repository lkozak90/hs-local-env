function replaceElementTag(targetSelector, newTagString) {
    $(targetSelector).each(function(){
        var newElem = $(newTagString, {html: $(this).html()});
        $.each(this.attributes, function() {
            newElem.attr(this.name, this.value);
        });
        $(this).replaceWith(newElem);
    });
}