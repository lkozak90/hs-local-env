ready(".hs_cos_wrapper_type_form form", function (element) {
  bfi_init(element);
  oneFieldForm(element);
});

function oneFieldForm(form) {
  if ($(form).find("> .hs-form-field").length === 1) {
    $(form).addClass("oneFieldForm");
  }
}