import { randomUUID } from "node:crypto";
import { z } from "zod";
import { row, rows, transaction } from "./db.js";
import { fail, parse, session } from "./security.js";
import { idempotent, requireId } from "./catalog.js";
import { bookingInput, diningSegments } from "./schemas.js";

function calendarDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const date = new Date(s + "T00:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === s
    ? +date
    : null;
}
const localDateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "medium",
  hourCycle: "h23",
});

export function bookingRoutes(app, db) {
  app.get("/reservations", async (req) => {
    const { digest } = await session(db, req, true);
    return (
      await rows(
        db,
        "SELECT data FROM vsm.bookings WHERE guest_hash=$1 ORDER BY created_at DESC",
        [digest],
      )
    ).map((r) => r.data);
  });
  app.post("/reservations", async (req, reply) => {
    const { digest } = await session(db, req, true);
    const data = parse(bookingInput, req.body);
    requireId(data.businessId);
    const booking = await idempotent(
      db,
      req,
      digest + ":booking",
      data,
      async (client) => {
        const owner = await row(client, `SELECT a.id FROM vsm.accounts a
          JOIN vsm.businesses b ON b.owner_id=a.id WHERE b.id=$1 AND a.deleted_at IS NULL FOR SHARE OF a`,
          [data.businessId]);
        const b = owner && await row(
          client,
          "SELECT data FROM vsm.businesses WHERE id=$1 AND status='Aprovado' AND deleted_at IS NULL FOR SHARE",
          [data.businessId],
        );
        if (!b?.data.acceptsReservations) fail(422, "Reservas indisponíveis.");
        const start = calendarDay(data.start);
        const now = localDateTime.format(new Date());
        if (start === null || data.start < now.slice(0, 10))
          fail(422, "Data inválida.");
        let roomName = "";
        let estimate = 0;
        if (data.kind === "hospedagem") {
          const end = calendarDay(data.end);
          const nights = end === null ? 0 : (end - start) / 86400000;
          const room = b.data.rooms.find((r) => r.id === data.roomId);
          if (
            b.data.segment !== "Hospedagem" ||
            nights < 1 ||
            !room ||
            data.adults + data.children > room.guests
          )
            fail(422, "Confira as datas e a acomodação.");
          roomName = room.name;
          estimate = Math.round(room.price * nights * 100) / 100;
        } else if (
          !diningSegments.includes(b.data.segment) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time) ||
          data.start + " " + data.time + ":00" <= now
        ) {
          fail(422, "Selecione uma data e um horário futuros.");
        }
        const createdAt = new Date().toISOString();
        const result = {
          ...data,
          id: randomUUID(),
          createdAt,
          roomName,
          estimate,
          status: "Pendente",
          reply: "",
        };
        await client.query("INSERT INTO vsm.bookings VALUES ($1,$2,$3,$4,$5)", [
          result.id,
          digest,
          data.businessId,
          result,
          createdAt,
        ]);
        return result;
      },
    );
    return reply.code(201).send(booking);
  });
  app.post("/reservations/:id/respond", async (req) => {
    const { accountId } = await session(db, req);
    const response = parse(
      z.object({
        status: z.enum(["Confirmada", "Recusada"]),
        reply: z.string().max(2000),
      }),
      req.body,
    );
    return change(req, "b.owner_id", accountId, response);
  });
  app.post("/reservations/:id/cancel", async (req) => {
    const { digest } = await session(db, req, true);
    return change(req, "r.guest_hash", digest, { status: "Cancelada" });
  });
  function change(req, identityColumn, identity, patch) {
    return transaction(db, async (client) => {
      const current = await row(
        client,
        "SELECT r.id,r.data FROM vsm.bookings r JOIN vsm.businesses b ON b.id=r.business_id WHERE r.id=$1 AND " +
          identityColumn +
          "=$2 FOR UPDATE OF r",
        [requireId(req.params.id), identity],
      );
      if (!current) fail(404, "Reserva não encontrada.");
      if (
        current.data.status === patch.status &&
        (patch.reply === undefined || current.data.reply === patch.reply)
      )
        return current.data;
      if (
        current.data.status !== "Pendente" &&
        !(patch.status === "Cancelada" && current.data.status === "Confirmada")
      )
        fail(409, "A reserva já foi atualizada.");
      const data = { ...current.data, ...patch };
      await client.query("UPDATE vsm.bookings SET data=$2 WHERE id=$1", [
        current.id,
        data,
      ]);
      return data;
    });
  }
}
