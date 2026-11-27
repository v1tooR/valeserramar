import { createHash, randomUUID } from "node:crypto";
import { constants, createWriteStream } from "node:fs";
import { copyFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { idempotent, uuid } from "../catalog.js";
import { row } from "../db.js";
import { checkGalleryLimit, maxGalleryPhotos, maxImageBytes, saveWebp } from "../media.js";
import { recordBusinessActivity } from "../moderation.js";
import {
  advertisingAgency, businessInput, businessSchema, credentials, regions, subcategorySegments,
} from "../schemas.js";
import { fail } from "../security.js";

export { regions };

export const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const photoFields = new Set(["photo", "logo"]);
const formFields = 44 + 30; // Includes removal controls for galleries saved under the former limit.
const formFiles = maxGalleryPhotos + photoFields.size;
const locations = new Map(regions.flatMap(({ name, cities }) =>
  cities.map(city => [name + "|" + city, { city, region: name }])));
export const categories = [
  ...businessSchema.shape.segment.options.map(segment => ({ label: segment, segment })),
  { label: advertisingAgency, segment: "Serviços", serviceType: advertisingAgency },
  ...Object.entries(subcategorySegments).map(([subcategory, segment]) =>
    ({ label: subcategory, segment, subcategory })),
  ...businessSchema.shape.lodgingType.unwrap().unwrap().options.map(lodgingType =>
    ({ label: lodgingType, segment: "Hospedagem", lodgingType })),
].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
const categoryByName = new Map(categories.map(({ label, ...option }) => [label, option]));
const time = /^([01]\d|2[0-3]):[0-5]\d$/;
const newBusinessDefaults = {
  photo: "", gallery: [], acceptsReservations: false, amenities: [], rooms: [],
  checkIn: "14:00", checkOut: "12:00",
};

async function stagePhoto(part, directory, index) {
  const incoming = join(directory, "incoming");
  const path = join(directory, index + ".webp");
  const digest = createHash("sha256");
  const checksum = new Transform({
    transform(chunk, _encoding, callback) {
      digest.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(part.file, checksum, createWriteStream(incoming, { flags: "wx", mode: 0o600 }));
  if (part.file.truncated) fail(413, "Cada imagem pode ter até 8 MB.");
  await saveWebp(incoming, path);
  await unlink(incoming);
  return { field: part.fieldname, path, digest: digest.digest("hex") };
}

export async function registrationPhotos(request, values, staging) {
  if (!request.isMultipart()) fail(422, "Abra o formulário de cadastro e tente novamente.");
  const photos = [];
  const singlePhotos = new Set();
  let galleryCount = 0;
  let first = true;
  try {
    for await (const part of request.parts({
      limits: {
        fieldNameSize: 50, fieldSize: 8192, fields: formFields, files: formFiles,
        parts: formFields + formFiles + 1, fileSize: maxImageBytes,
      },
    })) {
      const { fieldname } = part;
      if (first) {
        first = false;
        if (part.type !== "field" || fieldname !== "csrf" || part.value !== request.adminSession.csrf) {
          part.file?.resume();
          fail(403, "Atualize a página antes de enviar este formulário.");
        }
      }
      if (part.type === "file") {
        if (fieldname !== "gallery" && (!photoFields.has(fieldname) || singlePhotos.has(fieldname))) {
          part.file.resume();
          fail(422, "Envie uma capa e um logotipo por cadastro.");
        }
        if (!part.filename) {
          part.file.resume();
          continue;
        }
        if (fieldname === "gallery") {
          galleryCount += 1;
          if (galleryCount > maxGalleryPhotos) {
            part.file.resume();
            checkGalleryLimit([], [], galleryCount);
          }
        } else {
          singlePhotos.add(fieldname);
        }
        photos.push(await stagePhoto(part, staging, photos.length));
        continue;
      }
      if (part.fieldnameTruncated || part.valueTruncated || typeof part.value !== "string" ||
          Object.hasOwn(values, fieldname))
        fail(422, "Confira os campos do cadastro.");
      values[fieldname] = part.value;
    }
  } catch (error) {
    if (error.code === "FST_REQ_FILE_TOO_LARGE") fail(413, "Cada imagem pode ter até 8 MB.");
    if (error.code === "FST_FILES_LIMIT") fail(422, `A galeria pode ter até ${maxGalleryPhotos} fotos.`);
    throw error;
  }
  if (first) fail(403, "Atualize a página antes de enviar este formulário.");
  if (!uuid.test(values.key || "") || values.complete !== "1")
    fail(422, "O formulário chegou incompleto. Confira os dados e tente novamente.");
  return photos;
}

function coordinate(value) {
  const text = value?.trim() || "";
  if (!text) return null;
  return /^[+-]?\d+(?:[.,]\d+)?$/.test(text) ? Number(text.replace(",", ".")) : NaN;
}

function requireComplete({ name, address, description, phone }) {
  if (!name || !address || !description || !phone)
    fail(422, "Preencha nome, endereço, descrição e telefone do estabelecimento.");
}

function businessData(values) {
  const category = categoryByName.get(values.category);
  const location = locations.get(values.location);
  if (!category || !location) fail(422, "Selecione a categoria e a cidade.");

  const name = values.name?.trim() || "";
  const address = values.address?.trim() || "";
  const description = values.description?.trim() || "";
  const phone = values.phone?.trim() || "";
  if (name.length > 160 || address.length > 240 || description.length > 2000 || phone.length > 40)
    fail(422, "Confira o tamanho dos campos do cadastro.");
  if (phone && !/^(?:55)?\d{10,11}$/.test(phone.replace(/\D/g, "")))
    fail(422, "Informe o telefone comercial com DDD.");
  const cep = values.cep?.trim() || "";
  if (cep && !/^\d{5}-?\d{3}$/.test(cep)) fail(422, "Informe um CEP com oito dígitos.");
  const latitude = coordinate(values.latitude);
  const longitude = coordinate(values.longitude);
  if ((latitude === null) !== (longitude === null) ||
      (latitude !== null && !(Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180)))
    fail(422, "Informe a latitude e a longitude juntas, com valores válidos.");

  const hours = weekdays.map((day, index) => {
    const open = values["open-" + index] === "1";
    const from = values["from-" + index] || "09:00";
    const to = values["to-" + index] || "18:00";
    if (open && (!time.test(from) || !time.test(to) || from === to))
      fail(422, "Confira o horário de " + day.toLowerCase() + ".");
    return { day, open, from: time.test(from) ? from : "09:00", to: time.test(to) ? to : "18:00" };
  });
  const fields = {
    subcategory: null, lodgingType: null, ...category, ...location,
    name, address, description, phone, cep, hours, latitude, longitude,
    district: values.district?.trim().slice(0, 100) || "",
    number: values.number?.trim().slice(0, 24) || "",
    instagram: values.instagram?.trim().slice(0, 120) || "",
  };
  const business = businessInput.safeParse({ ...newBusinessDefaults, ...fields });
  if (!business.success) fail(422, "Confira os dados do estabelecimento.");
  if ("cnpj" in values || "publicEmail" in values) {
    const info = businessSchema.shape.publicInfo.safeParse({
      cnpj: values.cnpj?.trim().toUpperCase().replace(/[./-]/g, "") || undefined,
      email: values.publicEmail?.trim() || undefined,
    });
    if (!info.success) fail(422, "Confira o CNPJ e o e-mail público do estabelecimento.");
    fields.publicInfo = info.data;
  }
  return fields;
}

async function saveSubmission(db, { values, photos, mediaDir, origin, reviewer }, scope, payload, work) {
  const submission = { headers: { "idempotency-key": values.key } };
  const images = Object.fromEntries(photos.filter(photo => photo.field !== "gallery")
    .sort((a, b) => a.field.localeCompare(b.field)).map(({ field, digest }) => [field, digest]));
  const gallery = photos.filter(photo => photo.field === "gallery").map(({ digest }) => digest);
  if (gallery.length) images.gallery = gallery;
  const written = [];
  try {
    return await idempotent(db, submission, reviewer + ":" + scope, { ...payload, images }, async client => {
      return work(client, async (ownerId, record) => {
        for (const { field, path: source } of photos) {
          const id = randomUUID();
          const path = join(mediaDir, id + ".webp");
          await copyFile(source, path, constants.COPYFILE_EXCL);
          written.push({ id, path });
          await client.query("INSERT INTO vsm.media(id,owner_id) VALUES($1,$2)", [id, ownerId]);
          const address = origin + "/media/" + id;
          if (field === "gallery") record.gallery.push(address);
          else record[field] = address;
        }
      });
    });
  } catch (error) {
    await Promise.allSettled(written.map(async ({ id, path }) => {
      if (!(await row(db, "SELECT id FROM vsm.media WHERE id=$1", [id]))) await unlink(path);
    }));
    throw error;
  }
}

export async function createBusiness(db, submission) {
  const { values, reviewer } = submission;
  const ownerEmail = credentials.shape.email.safeParse(values.ownerEmail);
  if (!ownerEmail.success) fail(422, "Informe um e-mail válido para a conta do anunciante.");
  const business = { ...newBusinessDefaults, ...businessData(values) };
  requireComplete(business);
  return saveSubmission(db, submission, "admin-business", { ownerEmail: ownerEmail.data, business }, async (client, saveImages) => {
    const owner = await row(client, "SELECT id FROM vsm.accounts WHERE email=$1 AND deleted_at IS NULL FOR SHARE", [ownerEmail.data]);
    if (!owner) fail(422, "Use o e-mail de uma conta de anunciante ativa no app.");
    const record = { ...business, gallery: [] };
    await saveImages(owner.id, record);
    const created = await row(client, `INSERT INTO vsm.businesses(id,owner_id,status,data)
      VALUES($1,$2,'Em análise',$3) RETURNING id`, [randomUUID(), owner.id, record]);
    await recordBusinessActivity(client, {
      id: created.id, reviewer, previousStatus: "Novo cadastro", status: "Em análise", reason: "Cadastrado pelo painel.",
    });
    return created;
  });
}

export async function editBusiness(db, submission, id) {
  const { values, reviewer } = submission;
  const { version } = values;
  if (!/^\d{1,10}$/.test(version || "")) fail(422, "Atualize o formulário e tente novamente.");
  const fields = businessData(values);
  const removePhoto = values.removePhoto === "1";
  const removeLogo = values.removeLogo === "1";
  const removeGallery = Object.keys(values).filter(name => /^removeGallery-\d+$/.test(name) && values[name] === "1")
    .map(name => Number(name.slice("removeGallery-".length))).sort((a, b) => a - b);
  const additions = submission.photos.filter(photo => photo.field === "gallery").length;
  return saveSubmission(db, submission, "admin-business-edit:" + id, {
    version, fields, removePhoto, removeLogo, ...(removeGallery.length ? { removeGallery } : {}),
  }, async (client, saveImages) => {
    const current = await row(client, `SELECT status, owner_id, data, deleted_at, xmin::text AS version
      FROM vsm.businesses WHERE id=$1 FOR UPDATE`, [id]);
    if (!current) fail(404, "Estabelecimento não encontrado.");
    if (current.deleted_at || current.version !== version)
      fail(409, "O cadastro mudou. Abra o formulário novamente para editar.");
    if (current.status !== "Rascunho") requireComplete(fields);

    const previous = current.data.gallery ?? [];
    const removals = new Set(removeGallery);
    const gallery = previous.filter((_, index) => !removals.has(index));
    checkGalleryLimit(gallery, previous, additions);
    const record = { ...current.data, ...fields, gallery };
    if (!fields.serviceType) delete record.serviceType;
    if (removePhoto) record.photo = "";
    if (removeLogo) delete record.logo;
    await saveImages(current.owner_id, record);
    await client.query("UPDATE vsm.businesses SET data=$2 WHERE id=$1", [id, record]);
    await recordBusinessActivity(client, {
      id, reviewer, previousStatus: current.status, status: current.status, reason: "Dados editados pelo painel.",
    });
    return { id };
  });
}
