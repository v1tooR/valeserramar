import { uuid } from "../catalog.js";
import { maxGalleryPhotos } from "../media.js";
import { canReview, reviewStates } from "../moderation.js";
import { bookingStatuses, businessStatuses, canHighlight, highlightLimit, highlightPlacements } from "./data.js";
import { categories, regions, weekdays } from "./registration.js";

const panel = "/admin";
const stores = panel + "/estabelecimentos";
const newStore = stores + "/novo";
const trash = stores + "/lixeira";
const advertisers = panel + "/anunciantes";
const advertiserTrash = advertisers + "/lixeira";
const bookings = panel + "/reservas";
const menu = [
  ["overview", panel, "Visão geral"],
  ["businesses", stores, "Estabelecimentos"],
  ["accounts", advertisers, "Anunciantes"],
  ["bookings", bookings, "Reservas"],
  ["subscriptions", panel + "/assinaturas", "Assinaturas"],
  ["activity", panel + "/atividade", "Atividade"],
];
const escapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const e = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => escapes[char]);
const display = (value) => value == null || value === "" ? "—" : e(value);
const one = (list) => Array.isArray(list) ? list : [];
const numbers = new Intl.NumberFormat("pt-BR");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const timestamp = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
});
const statusTones = {
  "Em análise": "waiting", "Pendente": "waiting", "Aprovado": "good",
  "Confirmada": "good", "Ativa": "good", "Correções solicitadas": "attention",
  "Recusado": "bad", "Recusada": "bad", "Cancelada": "bad",
};
const formatMoney = (value) => value == null || value === "" || !Number.isFinite(Number(value)) ?
  "—" : e(currency.format(Number(value)));
const shortDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ?
  value.split("-").reverse().join("/") : display(value);
const initials = (value) => e(String(value || "VSM").trim().split(/\s+/).slice(0, 2)
  .map((word) => Array.from(word)[0] ?? "").join("").toUpperCase());
const csrf = (session) => `<input type="hidden" name="csrf" value="${e(session.csrf)}">`;
const asset = (file) => panel + "/assets/" + file;
const icon = (kind) => `<span aria-hidden="true" class="icon icon-${kind}"></span>`;

function document(title, body) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#123b30">
  <title>${e(title)} | Vila Serra e Mar</title>
  <link rel="stylesheet" href="${asset("panel.css")}?v=5">
</head>
<body>${body}</body>
</html>`;
}

function layout(title, active, session, body, intro = "") {
  const links = menu.map(([key, href, text]) =>
    `<a class="nav-link" href="${href}"${active === key ? ' aria-current="page"' : ""}>${icon(key)}${text}</a>`,
  ).join("");
  return document(title, `
    <a class="skip" href="#conteudo">Ir para o conteúdo</a>
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="${panel}"><img src="${asset("marca.png")}" alt="Vila Serra e Mar"></a>
        <nav aria-label="Administração">${links}</nav>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <span class="context">Administração</span>
          <div class="user">
            <span class="user-mark" aria-hidden="true">AD</span>
            <span class="user-email">${e(session.email)}</span>
            <form method="post" action="${panel}/sair">${csrf(session)}<button class="button plain" type="submit">Sair</button></form>
          </div>
        </header>
        <main id="conteudo" class="main">
          ${intro}<h1>${e(title)}</h1>
          ${body}
        </main>
      </div>
    </div>`);
}

export function login(message = "", email = "") {
  return document("Entrar no painel", `
    <main class="login">
      <section class="login-brand" aria-label="Vila Serra e Mar">
        <img src="${asset("marca.png")}" alt="Vila Serra e Mar">
      </section>
      <section class="login-workspace">
        <form class="login-card" action="${panel}/entrar" method="post">
          <h1>Entrar no painel</h1>
          <p>Use sua conta de administrador.</p>
          ${message ? `<p class="alert error" role="alert">${e(message)}</p>` : ""}
          <label>E-mail<input required name="email" type="email" autocomplete="username" maxlength="120" value="${e(email)}"></label>
          <label>Senha<input required name="password" type="password" autocomplete="current-password" maxlength="256"></label>
          <button class="button primary" type="submit">Entrar</button>
        </form>
      </section>
    </main>`);
}

export function errorPage(message, session) {
  const body = `<p class="alert error" role="alert">${e(message)}</p>
    <a class="button" href="${session ? stores : panel + "/entrar"}">${session ? "Voltar aos estabelecimentos" : "Voltar ao login"}</a>`;
  return session ? layout("Não foi possível continuar", "", session, body) :
    document("Não foi possível continuar", `<main class="standalone"><h1>Não foi possível continuar</h1>${body}</main>`);
}

function href(path, filters) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  return e(params.size ? path + "?" + params : path);
}

function badge(status) {
  const tone = Object.hasOwn(statusTones, status) ? statusTones[status] : "neutral";
  return `<span class="badge ${tone}">${display(status)}</span>`;
}

const businessBadge = (business) => badge(business.deleted_at ? "Na lixeira" : business.status);

function table(headers, body, empty, label) {
  return body.length ? `<div class="table-scroll" tabindex="0" role="region" aria-label="${e(label)}">
    <table><thead><tr>${headers.map((header) => `<th scope="col">${e(header)}</th>`).join("")}</tr></thead>
    <tbody>${body.join("")}</tbody></table></div>` :
    `<p class="empty">${e(empty)}</p>`;
}

function select(name, label, current, options, all) {
  return `<label>${label}<select name="${name}"><option value="">${all}</option>
    ${options.map((option) => `<option value="${e(option)}"${current === option ? " selected" : ""}>${e(option)}</option>`).join("")}</select></label>`;
}

function filters(path, values, placeholder, controls = "", context = {}) {
  const retained = Object.entries(context).filter(([, value]) => value)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${e(value)}">`).join("");
  const clear = Object.entries(values).some(([key, value]) => value && !Object.hasOwn(context, key)) ?
    `<a class="button plain" href="${href(path, context)}">Limpar</a>` : "";
  return `<form class="filters" method="get" action="${path}">
    ${retained}<label class="search">Buscar<input type="search" name="q" value="${e(values.q)}" maxlength="120" placeholder="${e(placeholder)}"></label>
    ${controls}<button class="button primary" type="submit">Filtrar</button>${clear}
  </form>`;
}

function pagination(result, path) {
  const { page, lastPage, filters = {}, total } = result;
  return `<footer class="pagination">
    <span>${numbers.format(total)} ${total === 1 ? "registro" : "registros"}</span>
    ${lastPage > 1 ? `<nav aria-label="Paginação">
      ${page > 1 ? `<a class="button small" href="${href(path, { ...filters, page: page - 1 })}">Anterior</a>` : ""}
      <span>Página ${page} de ${lastPage}</span>
      ${page < lastPage ? `<a class="button small" href="${href(path, { ...filters, page: page + 1 })}">Próxima</a>` : ""}
    </nav>` : ""}
  </footer>`;
}

function mediaPath(value, origin) {
  if (!value) return "";
  try {
    const url = new URL(value, origin);
    const id = url.pathname.split("/").at(-1);
    if (url.origin === origin && url.pathname === "/media/" + id &&
        uuid.test(id) && !url.search && !url.hash) return url.pathname;
  } catch {
    return "";
  }
  return "";
}

function businessCell(business, origin) {
  const name = business.name || "Cadastro sem nome";
  const photo = mediaPath(business.photo, origin);
  return `<div class="entity">
    ${photo ? `<img class="thumb" src="${photo}" alt="" loading="lazy">` : `<span class="initials" aria-hidden="true">${initials(name)}</span>`}
    <div><a class="entity-name" href="${stores}/${business.id}">${e(name)}</a>
    <div class="muted">${display(business.service_type || business.segment)}</div>
    ${business.home_highlight ? badge("Destaque no Início") : ""}
    ${business.explore_highlight ? badge("Destaque no Explorar") : ""}</div>
  </div>`;
}

function businessTable(records, origin, empty) {
  return table(["Estabelecimento", "Localização", "Status", "Ação"], records.map((b) =>
    `<tr><td>${businessCell(b, origin)}</td>
      <td>${display(b.city)}<div class="muted">${display(b.region)}</div></td>
      <td>${businessBadge(b)}${b.owner_deleted_at ? `<div>${badge("Anunciante na lixeira")}</div>` : ""}</td>
      <td><div class="actions"><a class="button small" href="${stores}/${b.id}" aria-label="Abrir ${e(b.name || "cadastro")}">${b.status === "Em análise" ? "Revisar" : "Ver detalhes"}</a>
        ${b.deleted_at ? "" : `<a class="button small" href="${stores}/${b.id}/editar">Editar</a>`}</div></td></tr>`,
  ), empty, "Estabelecimentos");
}

function eventList(records) {
  return records.length ? `<ol class="event-list">${records.map((record) => `
    <li>
      <span class="event-mark" aria-hidden="true"></span>
      <div><a class="entity-name" href="${stores}/${record.business_id}">${e(record.name || "Estabelecimento")}</a>
        <div class="event-status">${badge(record.status)}</div>
        <div class="muted">${e(record.reviewer)} · ${e(timestamp.format(new Date(record.created_at)))}</div>
        ${record.reason ? `<p class="event-reason">${e(record.reason)}</p>` : ""}
      </div>
    </li>`).join("")}</ol>` : `<p class="empty">Nenhuma atividade registrada no painel.</p>`;
}

export function overviewPage({ counts, queue, activity }, session, origin) {
  const cards = [
    ["review", "Em análise", counts.pending, href(stores, { status: "Em análise" })],
    ["businesses", "Publicados", counts.published, href(stores, { status: "Aprovado" })],
    ["accounts", "Anunciantes", counts.accounts, advertisers],
    ["bookings", "Reservas pendentes", counts.bookings, href(bookings, { status: "Pendente" })],
  ].map(([kind, label, count, url]) => `<a class="metric" href="${url}">
    <span class="metric-icon metric-${kind}">${icon(kind)}</span>
    <span class="metric-value">${numbers.format(count)}</span><span class="metric-label">${label}</span>
  </a>`).join("");
  return layout("Visão geral", "overview", session, `
    <div class="metrics">${cards}</div>
    <div class="overview-grid">
      <section class="card"><header class="section-head"><h2>Fila de aprovação</h2>
        <a class="button small" href="${href(stores, { status: "Em análise" })}">Ver fila</a></header>
        ${businessTable(queue, origin, "Nenhum estabelecimento aguardando análise.")}
      </section>
      <section class="card"><header class="section-head"><h2>Atividade recente</h2>
        <a class="text-link" href="${panel}/atividade">Histórico</a></header>
        ${eventList(activity)}
      </section>
    </div>`);
}

export function businessList(result, session, origin, removed = false) {
  const current = result.filters;
  const path = result.deleted ? trash : stores;
  const controls = (result.deleted ? "" : select("status", "Status", current.status, businessStatuses, "Todos os status")) +
    select("segment", "Categoria", current.segment, categories.map(({ label }) => label), "Todas as categorias");
  return layout(result.deleted ? "Lixeira de estabelecimentos" : "Estabelecimentos", "businesses", session, `
    <div class="list-actions">
      ${result.deleted ? `<a class="button" href="${href(stores, { owner: current.owner })}">Ver estabelecimentos</a>` : `
      <a class="button" href="${href(trash, { owner: current.owner })}">Lixeira</a>
      <a class="button primary" href="${href(newStore, { owner: current.owner })}">Cadastrar estabelecimento</a>
      `}
    </div>
    ${removed ? '<p class="alert" role="status">Estabelecimento movido para a lixeira.</p>' : ""}
    ${current.owner ? `<p class="scope"><span>Anúncios do anunciante selecionado</span>
      <a href="${href(path, { ...current, owner: "" })}">Ver todos</a></p>` : ""}
    <section class="card">
      ${filters(path, current, "Nome, cidade ou anunciante", controls, { owner: current.owner })}
      ${businessTable(result.records, origin, result.deleted ? "Nenhum estabelecimento na lixeira." : "Nenhum estabelecimento encontrado.")}
      ${pagination(result, path)}
    </section>`);
}

function registrationInput(values, name, label, maxlength, required = false, type = "text") {
  return `<label>${label}<input name="${name}" type="${type}" maxlength="${maxlength}"${required ? " required" : ""}
    value="${e(values[name])}"></label>`;
}

export function registrationPage(session, values, { message = "", business, origin = "" } = {}) {
  const option = (value, current, label = value) =>
    `<option value="${e(value)}"${value === current ? " selected" : ""}>${e(label)}</option>`;
  const required = business?.status !== "Rascunho";
  const back = business ? stores + "/" + business.id : stores;
  const action = business ? back + "/editar" : newStore;
  const photoFields = [
    ["photo", "Capa do anúncio", "removePhoto", "Remover capa atual"],
    ["logo", "Logotipo", "removeLogo", "Remover logotipo atual"],
  ].map(([name, label, removal, removeLabel]) => {
    const src = business && mediaPath(business.data[name], origin);
    return `<div class="photo-field">
      ${src ? `<img class="form-image ${name}" src="${src}" alt="${label} atual">` : ""}
      <label>${label} <span class="muted">(opcional)</span><input name="${name}" type="file" accept="image/jpeg,image/png,image/webp"></label>
      ${business?.data[name] ? `<label class="open-day"><input name="${removal}" type="checkbox" value="1"${values[removal] === "1" ? " checked" : ""}>${removeLabel}</label>` : ""}
    </div>`;
  }).join("");
  const gallery = one(business?.data.gallery);
  const galleryCount = gallery.filter((_, index) => values["removeGallery-" + index] !== "1").length;
  return layout(business ? "Editar estabelecimento" : "Cadastrar estabelecimento", "businesses", session, `
    <form class="registration-form stack" method="post" action="${action}" enctype="multipart/form-data">
      ${csrf(session)}<input type="hidden" name="key" value="${e(values.key)}">
      ${business ? `<input type="hidden" name="version" value="${e(values.version ?? business.version)}">` : ""}
      ${message ? `<p class="alert error" role="alert">${e(message)}</p>` : ""}
      ${business?.status === "Aprovado" ? '<p class="alert">As alterações salvas serão exibidas no catálogo do app.</p>' : ""}
      <section class="card padded">
        <h2>Anunciante</h2>
        <div class="registration-owner">
          ${business ? details([["Nome", business.owner_name], ["E-mail", business.owner_email]]) : `
          ${registrationInput(values, "ownerEmail", "E-mail do anunciante", 254, true, "email")}
          <p class="muted">Use o e-mail da conta cadastrada no app. <a class="text-link" href="${panel}/anunciantes">Consultar anunciantes</a></p>
          `}
        </div>
      </section>
      <section class="card padded">
        <h2>Dados do estabelecimento</h2>
        <div class="registration-fields">
          ${registrationInput(values, "name", "Nome do estabelecimento", 160, required)}
          <label>Categoria<select name="category" required>
            <option value="">Selecione a categoria</option>
            ${categories.map(({ label }) => option(label, values.category)).join("")}
          </select></label>
          <label class="form-wide">Descrição<textarea name="description" rows="4" maxlength="2000"${required ? " required" : ""}>${e(values.description)}</textarea></label>
          ${registrationInput(values, "phone", "Telefone comercial com DDD", 40, required, "tel")}
          ${registrationInput(values, "instagram", "Instagram (opcional)", 120)}
        </div>
      </section>
      <section class="card padded">
        <h2>Localização</h2>
        <div class="registration-fields">
          <label>Cidade<select name="location" required>
            <option value="">Selecione a cidade</option>
            ${regions.map(({ name, cities }) => `<optgroup label="${e(name)}">${cities.map(city =>
              option(name + "|" + city, values.location, city)).join("")}</optgroup>`).join("")}
          </select></label>
          ${registrationInput(values, "cep", "CEP (opcional)", 9)}
          ${registrationInput(values, "address", "Endereço", 240, required)}
          ${registrationInput(values, "number", "Número (opcional)", 24)}
          ${registrationInput(values, "district", "Bairro (opcional)", 100)}
          <p class="muted form-wide form-help">Informe latitude e longitude para posicionar o estabelecimento no mapa do app.</p>
          ${registrationInput(values, "latitude", "Latitude (opcional)", 32)}
          ${registrationInput(values, "longitude", "Longitude (opcional)", 32)}
        </div>
      </section>
      <section class="card padded">
        <h2>Fotos</h2>
        <p class="muted">JPG, PNG ou WebP, até 8 MB por imagem.</p>
        <div class="registration-fields">${photoFields}</div>
        <div class="registration-gallery" data-gallery-limit="${maxGalleryPhotos}">
          <label>Galeria de fotos <span class="muted">(opcional)</span>
            <input name="gallery" type="file" multiple accept="image/jpeg,image/png,image/webp"
              data-gallery-input aria-describedby="gallery-help gallery-count">
          </label>
          <p class="muted form-help" id="gallery-help">Selecione até ${maxGalleryPhotos} fotos para a galeria.</p>
          <p class="muted form-help" id="gallery-count" data-gallery-count role="status">${galleryCount} de ${maxGalleryPhotos} fotos</p>
          ${gallery.length ? `<div class="gallery gallery-edit">
            ${gallery.map((photo, index) => {
              const source = mediaPath(photo, origin);
              const field = "removeGallery-" + index;
              return `<div>
                ${source ? `<img src="${source}" alt="Foto ${index + 1} da galeria" loading="lazy">` : ""}
                <label class="open-day"><input type="checkbox" name="${field}" value="1" data-gallery-removal${values[field] === "1" ? " checked" : ""}>Remover foto ${index + 1}</label>
              </div>`;
            }).join("")}
          </div>` : ""}
        </div>
        ${message ? `<p class="muted form-help">Selecione novamente as imagens que deseja enviar.</p>` : ""}
      </section>
      <details class="card padded registration-hours"${weekdays.some((_, i) => values["open-" + i] === "1") ? " open" : ""}>
          <summary>Horários de atendimento</summary>
          <div class="hours-grid">
            ${weekdays.map((day, i) => `<div class="hours-row">
              <label class="open-day"><input type="checkbox" name="open-${i}" value="1"${values["open-" + i] === "1" ? " checked" : ""}>${day}</label>
              <label>Abertura<input type="time" name="from-${i}" aria-label="Abertura de ${day}" value="${e(values["from-" + i] ?? "09:00")}"></label>
              <label>Fechamento<input type="time" name="to-${i}" aria-label="Fechamento de ${day}" value="${e(values["to-" + i] ?? "18:00")}"></label>
            </div>`).join("")}
          </div>
      </details>
      <input type="hidden" name="complete" value="1">
      <div class="actions registration-actions">
        <button class="button primary" type="submit">${business ? "Salvar alterações" : "Cadastrar e enviar para análise"}</button>
        <a class="button plain" href="${back}">Cancelar</a>
      </div>
    </form>
    <script src="${asset("gallery.js")}?v=1" defer></script>`, `<a class="back-link" href="${back}">${business ? "Voltar ao estabelecimento" : "Voltar aos estabelecimentos"}</a>`);
}

function details(fields, variant = "") {
  return `<dl class="detail-fields ${variant}">${fields.map(([label, value]) =>
    `<div><dt>${e(label)}</dt><dd>${display(value)}</dd></div>`,
  ).join("")}</dl>`;
}

function reviewForm(business, session, action, label, reason = "", required = false, tone = "") {
  return `<form method="post" action="${stores}/${business.id}/revisar" class="review-form">
    ${csrf(session)}<input type="hidden" name="version" value="${e(business.version)}">
    <input type="hidden" name="action" value="${action}">
    ${reason ? `<label>${reason}<textarea name="reason" rows="3" maxlength="2000"${required ? " required" : ""}></textarea></label>` : ""}
    <button class="button ${tone}" type="submit">${label}</button>
  </form>`;
}

function trashForm(business, session, removing) {
  return `<form method="post" action="${stores}/${business.id}/${removing ? "excluir" : "restaurar"}" class="actions">
    ${csrf(session)}<input type="hidden" name="version" value="${e(business.version)}">
    <button class="button ${removing ? "danger" : "primary"}" type="submit">${removing ? "Mover para a lixeira" : "Restaurar para análise"}</button>
    ${removing ? `<a class="button plain" href="${stores}/${business.id}">Cancelar</a>` : ""}
  </form>`;
}

export function deleteBusinessPage(business, session) {
  return layout("Excluir estabelecimento", "businesses", session, `
    <section class="card padded confirmation-card">
      <h2>${display(business.data.name)}</h2>
      <p>O estabelecimento sairá do catálogo e da área do anunciante. A lixeira preserva as reservas, a assinatura e o histórico para consulta e permite restaurar o cadastro para análise.</p>
      ${trashForm(business, session, true)}
    </section>`, `<a class="back-link" href="${stores}/${business.id}">Voltar ao estabelecimento</a>`);
}

function highlightSettings(business, counts, session) {
  const eligible = canHighlight(business);
  return `<section class="card padded">
    <h2>Destaques no app</h2>
    <p class="muted">${eligible
      ? "A foto de capa será exibida como banner nos locais selecionados."
      : "Para publicar um destaque, aprove o estabelecimento e adicione uma foto de capa."}</p>
    ${eligible ? Object.entries(highlightPlacements).map(([placement, { label, column }]) => {
      const active = Boolean(business[column]);
      return `<div class="highlight-setting">
        <div><strong>${label}</strong><div class="muted">${counts[placement]} de ${highlightLimit} vagas ocupadas</div></div>
        <form method="post" action="${stores}/${business.id}/destaque">
          ${csrf(session)}<input type="hidden" name="placement" value="${placement}">
          <input type="hidden" name="enabled" value="${active ? "0" : "1"}">
          <button class="button small${active ? "" : " primary"}" type="submit"
            aria-label="${active ? "Retirar destaque de" : "Publicar destaque em"} ${label}"
            ${!active && counts[placement] >= highlightLimit ? "disabled" : ""}>${active ? "Retirar" : "Publicar"}</button>
        </form>
      </div>`;
    }).join("") : ""}
  </section>`;
}

export function businessPage({ business: b, products, activity, subscription, bookings: totals, highlights }, session, origin, action, { created, edited, restored, highlightSaved } = {}) {
  const data = b.data;
  const logo = mediaPath(data.logo, origin);
  const photos = [...new Set([data.photo, ...one(data.gallery)]
    .map((photo) => mediaPath(photo, origin)).filter(Boolean))];
  const images = photos.length ? `<div class="gallery">${photos.map((src, index) =>
    `<img src="${src}" loading="lazy" alt="${index === 0 ? "Foto do estabelecimento" : "Foto da galeria"}">`).join("")}</div>` : "";
  const pending = !b.deleted_at && canReview("aprovar", b.status);
  let notice = !b.deleted_at && reviewStates[action] === b.status ? {
    aprovar: "Estabelecimento aprovado e publicado no catálogo.",
    corrigir: "Pedido de correção registrado para o anunciante.",
    recusar: "Estabelecimento recusado.",
    desativar: "Estabelecimento desativado.",
    reativar: "Estabelecimento reenviado para análise.",
  }[action] : "";
  if (created && pending) notice = "Estabelecimento cadastrado e enviado para análise.";
  if (edited && !b.deleted_at) notice = "Alterações salvas.";
  if (restored && pending) notice = "Estabelecimento restaurado para análise.";
  if (highlightSaved && !b.deleted_at) notice = "Destaques atualizados no app.";
  const hours = one(data.hours).filter((hour) => hour?.day);
  const rooms = one(data.rooms).filter((room) => room?.name);
  const address = [data.address, data.number, data.district].filter(Boolean).join(", ");
  const category = [data.segment, data.serviceType || data.lodgingType || data.subcategory].filter(Boolean).join(" · ");
  return layout(data.name || "Cadastro sem nome", "businesses", session, `
    <div class="detail-top">${businessBadge(b)}<span class="muted">${display(data.city)} · ${display(data.region)}</span>
      ${b.deleted_at ? `<span class="muted">Excluído em ${e(timestamp.format(new Date(b.deleted_at)))}</span>` : ""}</div>
    ${notice ? `<p class="alert success" role="status">${notice}</p>` : ""}
    ${b.owner_deleted_at ? `<p class="alert">O anunciante está na lixeira. Este estabelecimento está oculto no catálogo.</p>` : ""}
    <div class="detail-grid">
      <div class="stack">
        <section class="card padded">
          <h2>Dados do cadastro</h2>
          ${images}
          ${logo ? `<figure class="record-logo"><img src="${logo}" alt="Logotipo do estabelecimento"><figcaption>Logotipo</figcaption></figure>` : ""}
          ${details([
            ["Categoria", category], ["Endereço", address], ["CEP", data.cep],
            ["Telefone comercial", data.phone], ["Instagram", data.instagram],
            ["Coordenadas", typeof data.latitude === "number" && typeof data.longitude === "number" ?
              data.latitude + ", " + data.longitude : ""],
            ["Reservas no app", data.acceptsReservations ? "Habilitadas" : "Desabilitadas"],
          ])}
          ${data.description ? `<h3>Descrição</h3><p class="paragraph">${e(data.description)}</p>` : ""}
          ${hours.length ? `<details class="disclosure"><summary>Horários</summary>${
            details(hours.map((hour) => [hour.day, hour.open ? [hour.from, hour.to].filter(Boolean).join(" às ") : "Fechado"]))
          }</details>` : ""}
          ${rooms.length ? `<details class="disclosure"><summary>Acomodações</summary>
            <ul class="plain-list">${rooms.map((room) => `<li><strong>${e(room.name)}</strong> · ${formatMoney(room.price)} · ${e(room.guests)} hóspedes</li>`).join("")}</ul></details>` : ""}
        </section>
        <section class="card padded">
          <div class="section-head inner"><h2>Anunciante</h2><a class="text-link" href="${advertisers}/${b.owner_id}">Ver anunciante</a></div>
          ${details([["Nome", b.owner_name], ["E-mail", b.owner_email], ["Telefone", b.owner_phone]], "contact-fields")}
          <a class="text-link" href="${href(stores, { owner: b.owner_id })}">Outros anúncios</a>
        </section>
        <section class="card"><header class="section-head"><h2>Produtos cadastrados</h2></header>
          ${table(["Produto", "Categoria", "Preço", "Disponibilidade"], products.map((p) =>
            `<tr><td>${display(p.name)}</td><td>${display(p.category)}</td><td>${formatMoney(p.price)}</td><td>${p.available ? "Disponível" : "Indisponível"}</td></tr>`),
          "Nenhum produto cadastrado.", "Produtos")}
        </section>
      </div>
      <div class="stack">
        ${b.deleted_at ? `<section class="card padded">
          <h2>Lixeira</h2>
          <p class="muted">Ao restaurar, o estabelecimento volta para a fila de análise.</p>
          ${trashForm(b, session, false)}
        </section>` : `
        <section class="card padded">
          <h2>Gerenciar estabelecimento</h2>
          <div class="actions"><a class="button primary" href="${stores}/${b.id}/editar">Editar</a>
            <a class="button danger" href="${stores}/${b.id}/excluir">Excluir</a></div>
        </section>
        ${b.owner_deleted_at ? "" : highlightSettings(b, highlights, session)}
        <section class="card padded">
          <h2>Revisão</h2>
          ${b.correction ? `<div class="alert"><strong>Motivo registrado</strong><p>${e(b.correction)}</p></div>` : ""}
          ${pending && !b.owner_deleted_at ? `<p class="muted">A aprovação publica este estabelecimento no catálogo do app.</p>
            ${reviewForm(b, session, "aprovar", "Aprovar e publicar", "", false, "primary")}
            <details class="disclosure"><summary>Solicitar correções</summary>
              ${reviewForm(b, session, "corrigir", "Enviar correções", "O que precisa ser ajustado?", true)}</details>
            <details class="disclosure"><summary>Recusar cadastro</summary>
              ${reviewForm(b, session, "recusar", "Confirmar recusa", "Motivo da recusa", false, "danger")}</details>
          ` : `<p class="muted">Status atual ${badge(b.status)}</p>`}
          ${canReview("reativar", b.status) ? `<p class="muted">Reenvie o cadastro para análise para reativá-lo.</p>
            ${reviewForm(b, session, "reativar", "Reativar para análise")}` : ""}
          ${canReview("desativar", b.status) ? `<details class="disclosure"><summary>Desativar estabelecimento</summary>
            <p class="muted">O anúncio ficará indisponível no catálogo.</p>
            ${reviewForm(b, session, "desativar", "Confirmar desativação", "Motivo da desativação", false, "danger")}</details>` : ""}
        </section>`}
        <section class="card padded">
          <h2>Operação</h2>
          ${details([["Reservas", totals.total], ["Pendentes", totals.pending], ["Assinatura", subscription?.status || "Não contratada"]])}
          <div class="actions"><a class="button small" href="${href(bookings, { business: b.id })}">Ver reservas</a>
            <a class="button small" href="${href(panel + "/assinaturas", { business: b.id })}">Ver assinatura</a></div>
        </section>
        <section class="card"><header class="section-head"><h2>Histórico do estabelecimento</h2></header>${eventList(activity)}</section>
      </div>
    </div>`, `<a class="back-link" href="${b.deleted_at ? trash : stores}">${b.deleted_at ? "Voltar à lixeira" : "Voltar aos estabelecimentos"}</a>`);
}

export function accountList(result, session, removed = false) {
  const path = result.deleted ? advertiserTrash : advertisers;
  return layout(result.deleted ? "Lixeira de anunciantes" : "Anunciantes", "accounts", session, `
    <div class="list-actions"><a class="button" href="${result.deleted ? advertisers : advertiserTrash}">${result.deleted ? "Ver anunciantes" : "Lixeira"}</a></div>
    ${removed ? '<p class="alert success" role="status">Anunciante movido para a lixeira.</p>' : ""}
    <section class="card">
      ${filters(path, result.filters, "Nome, e-mail ou telefone")}
      ${table(["Anunciante", "Telefone", "Anúncios", "Ações"], result.records.map((a) =>
        `<tr><td><a class="entity-name" href="${advertisers}/${a.id}">${display(a.name)}</a><div class="muted">${display(a.email)}</div></td>
          <td>${display(a.phone)}</td><td>${numbers.format(a.businesses)}</td>
          <td><div class="actions">
            <a class="button small" href="${href(stores, { owner: a.id })}">Ver anúncios</a>
            ${a.deleted_at ? `<a class="button small" href="${advertisers}/${a.id}">Ver e restaurar</a>` : `
              <a class="button small" href="${href(newStore, { owner: a.id })}">Cadastrar estabelecimento</a>
              <a class="button small" href="${advertisers}/${a.id}/editar" aria-label="Editar ${e(a.name)}">Editar</a>`}
          </div></td></tr>`),
      result.deleted ? "Nenhum anunciante na lixeira." : "Nenhum anunciante encontrado.", "Anunciantes")}
      ${pagination(result, path)}
    </section>`);
}

const advertiserEvents = {
  editado: "Dados do anunciante editados",
  excluido: "Anunciante movido para a lixeira",
  restaurado: "Anunciante restaurado",
};

function advertiserTrashForm(account, session, removing) {
  const path = `${advertisers}/${account.id}`;
  return `<form class="actions" method="post" action="${path}/${removing ? "excluir" : "restaurar"}">
    ${csrf(session)}<input type="hidden" name="version" value="${e(account.version)}">
    <button class="button ${removing ? "danger" : "primary"}" type="submit">${removing ? "Mover para a lixeira" : "Restaurar anunciante"}</button>
    ${removing ? `<a class="button plain" href="${path}">Cancelar</a>` : ""}
  </form>`;
}

export function advertiserPage(account, history, session, query) {
  const path = `${advertisers}/${account.id}`;
  const notice = account.deleted_at ? "" : query.restaurado === "1" ? "Anunciante restaurado." :
    query.editado === "1" ? "Alterações salvas." : "";
  return layout(account.name || "Anunciante", "accounts", session, `
    ${notice ? `<p class="alert success" role="status">${notice}</p>` : ""}
    <div class="detail-grid">
      <div class="stack">
        <section class="card padded">
          <div class="detail-top">${badge(account.deleted_at ? "Na lixeira" : "Ativa")}</div>
          <h2>Dados da conta</h2>
          ${details([["E-mail", account.email], ["Telefone", account.phone], ["Estabelecimentos vinculados", numbers.format(account.businesses)]])}
          <div class="actions">
            <a class="button" href="${href(stores, { owner: account.id })}">Ver anúncios</a>
            ${account.deleted_at ? "" : `<a class="button" href="${href(newStore, { owner: account.id })}">Cadastrar estabelecimento</a>`}
          </div>
        </section>
        <section class="card"><header class="section-head"><h2>Histórico do anunciante</h2></header>
          ${history.length ? `<ol class="event-list">${history.map((event) => `<li>
            <span class="event-mark" aria-hidden="true"></span>
            <div><strong>${e(advertiserEvents[event.action])}</strong>
              <div class="muted">${e(event.reviewer)} · ${e(timestamp.format(new Date(event.created_at)))}</div>
            </div></li>`).join("")}</ol>` : '<p class="empty">Nenhuma alteração registrada no painel.</p>'}
        </section>
      </div>
      <div class="stack">
        <section class="card padded">
          <h2>${account.deleted_at ? "Restaurar conta" : "Gerenciar anunciante"}</h2>
          ${account.deleted_at ? `
            <p class="muted">Na lixeira desde ${e(timestamp.format(new Date(account.deleted_at)))}. A restauração libera o acesso ao app e republica os anúncios que continuam aprovados.</p>
            ${advertiserTrashForm(account, session, false)}` : `
            <div class="actions"><a class="button primary" href="${path}/editar">Editar dados</a>
              <a class="button danger" href="${path}/excluir">Excluir anunciante</a></div>`}
        </section>
      </div>
    </div>`, `<a class="back-link" href="${account.deleted_at ? advertiserTrash : advertisers}">${account.deleted_at ? "Voltar à lixeira" : "Voltar aos anunciantes"}</a>`);
}

export function advertiserForm(account, session, values = account, message = "") {
  const path = `${advertisers}/${account.id}`;
  return layout("Editar anunciante", "accounts", session, `
    <form class="card padded confirmation-card review-form" method="post" action="${path}/editar">
      ${csrf(session)}<input type="hidden" name="version" value="${e(values.version ?? account.version)}">
      ${message ? `<p class="alert error" role="alert">${e(message)}</p>` : ""}
      ${registrationInput(values, "name", "Nome", 160, true)}
      ${registrationInput(values, "email", "E-mail de acesso ao app", 254, true, "email")}
      <p class="muted">Ao trocar o e-mail, o anunciante precisará entrar no app com o novo endereço e a senha atual.</p>
      ${registrationInput(values, "phone", "Telefone", 40, false, "tel")}
      <div class="actions"><button class="button primary" type="submit">Salvar alterações</button>
        <a class="button plain" href="${path}">Cancelar</a></div>
    </form>`, `<a class="back-link" href="${path}">Voltar ao anunciante</a>`);
}

export function deleteAdvertiserPage(account, session) {
  return layout("Excluir anunciante", "accounts", session, `
    <section class="card padded confirmation-card">
      <h2>${display(account.name)}</h2>
      <p>Ao mover esta conta para a lixeira, o acesso ao app será bloqueado e os anúncios vinculados sairão do catálogo e dos destaques. O painel preserva os estabelecimentos, as reservas e o histórico.</p>
      <p class="muted">Você pode restaurar a conta pela lixeira. Para voltar aos destaques, selecione os anúncios novamente.</p>
      ${advertiserTrashForm(account, session, true)}
    </section>`, `<a class="back-link" href="${advertisers}/${account.id}">Voltar ao anunciante</a>`);
}

const bookingKind = (kind) => kind === "mesa" ? "Mesa" : kind === "hospedagem" ? "Hospedagem" : display(kind);

export function bookingList(result, session) {
  const current = result.filters;
  return layout("Reservas", "bookings", session, `
    ${current.business ? `<p class="scope"><span>Reservas do estabelecimento selecionado</span>
      <a href="${href(bookings, { ...current, business: "" })}">Ver todas</a></p>` : ""}
    <section class="card">
    ${filters(bookings, current, "Estabelecimento, visitante ou telefone",
       select("status", "Status", current.status, bookingStatuses, "Todos os status"), { business: current.business })}
    ${table(["Estabelecimento", "Visitante", "Data", "Status", "Ação"], result.records.map((r) =>
      `<tr><td><a class="entity-name" href="${stores}/${r.business_id}">${display(r.name)}</a><div class="muted">${bookingKind(r.kind)}</div>
        ${r.deleted_at ? badge("Na lixeira") : ""}</td>
        <td>${display(r.guest)}</td><td>${shortDate(r.starts)}</td><td>${badge(r.status)}</td>
        <td><a class="button small" href="${bookings}/${r.id}">Ver detalhes</a></td></tr>`),
      "Nenhuma reserva encontrada.", "Reservas")}
    ${pagination(result, bookings)}
  </section>`);
}

export function bookingPage(booking, session) {
  const r = booking.data;
  return layout("Detalhes da reserva", "bookings", session, `
    <section class="card padded">
      <div class="detail-top">${badge(r.status)}<a class="text-link" href="${stores}/${booking.business_id}">${display(booking.name)}</a>
        ${booking.deleted_at ? badge("Na lixeira") : ""}</div>
      ${details([
        ["Tipo", bookingKind(r.kind)], ["Visitante", r.name], ["Telefone", r.phone],
        ["Entrada", shortDate(r.start)], ["Saída", shortDate(r.end)], ["Horário", r.time],
        ["Adultos", r.adults], ["Crianças", r.children], ["Acomodação", r.roomName],
        ["Estimativa", formatMoney(r.estimate)],
      ])}
      ${r.notes ? `<h2>Observação do visitante</h2><p class="paragraph">${e(r.notes)}</p>` : ""}
      ${r.reply ? `<h2>Resposta do estabelecimento</h2><p class="paragraph">${e(r.reply)}</p>` : ""}
    </section>`, `<a class="back-link" href="${bookings}">Voltar às reservas</a>`);
}

export function subscriptionList(result, session) {
  const path = panel + "/assinaturas";
  const current = result.filters;
  return layout("Assinaturas", "subscriptions", session, `
    ${current.business ? `<p class="scope"><span>Assinatura do estabelecimento selecionado</span>
      <a href="${href(path, { ...current, business: "" })}">Ver todas</a></p>` : ""}
    <section class="card">
    ${filters(path, current, "Estabelecimento, plano ou status",
      select("status", "Status", current.status, result.statuses, "Todos os status"), { business: current.business })}
    ${table(["Estabelecimento", "Plano", "Valor", "Vencimento", "Status"], result.records.map((s) =>
      `<tr><td><a class="entity-name" href="${stores}/${s.id}">${display(s.name)}</a>
        ${s.deleted_at ? '<div>' + badge("Na lixeira") + '</div>' : ""}</td>
        <td>${display(s.plan)}</td><td>${formatMoney(s.amount)}</td>
        <td>${shortDate(s.due_date)}</td><td>${badge(s.status)}</td></tr>`),
      "Nenhum estabelecimento encontrado.", "Assinaturas")}
    ${pagination(result, path)}
  </section>`);
}

export function activityPage(result, session) {
  const path = panel + "/atividade";
  return layout("Atividade", "activity", session, `<section class="card">
    ${filters(path, result.filters, "Estabelecimento, administrador ou ação")}
    ${table(["Estabelecimento", "Ação", "Administrador", "Data"], result.records.map((event) =>
      `<tr><td><a class="entity-name" href="${stores}/${event.business_id}">${e(event.name || "Estabelecimento")}</a></td>
        <td>${badge(event.status)}${event.status === event.previous_status ? "" : `<div class="muted">Anterior ${e(event.previous_status)}</div>`}
          ${event.reason ? `<p class="event-reason">${e(event.reason)}</p>` : ""}</td>
        <td>${e(event.reviewer)}</td><td>${e(timestamp.format(new Date(event.created_at)))}</td></tr>`),
      "Nenhuma atividade encontrada.", "Histórico do painel")}
    ${pagination(result, path)}
  </section>`);
}
