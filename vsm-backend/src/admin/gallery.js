const gallery = document.querySelector(".registration-gallery");
const input = gallery.querySelector("[data-gallery-input]");
const count = gallery.querySelector("[data-gallery-count]");
const removals = Array.from(gallery.querySelectorAll("[data-gallery-removal]"));
const limit = Number(gallery.dataset.galleryLimit);

function updateGalleryCount() {
  const retained = removals.filter(checkbox => !checkbox.checked).length;
  const selected = input.files.length;
  const total = retained + selected;
  const tooMany = selected > 0 && total > limit;
  const message = `A galeria pode ter até ${limit} fotos. Remova ${total - limit} da seleção ou da galeria atual.`;
  input.setCustomValidity(tooMany ? message : "");
  count.toggleAttribute("data-invalid", tooMany);
  count.textContent = tooMany ? message : `${total} de ${limit} fotos`;
}

gallery.addEventListener("change", updateGalleryCount);
updateGalleryCount();
