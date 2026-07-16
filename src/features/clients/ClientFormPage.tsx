import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createClient, updateClient } from "@/application/commands/client.commands";
import { getClient } from "@/application/queries/list-clients.query";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Field } from "@/components/forms/Field";
import type { ClientInput } from "@/domain/clients/types";
import { useDatabase } from "@/infrastructure/database/use-database";

const EMPTY: ClientInput = {
  name: "",
  contactName: "",
  postalCode: "",
  address: "",
  phone: "",
  email: "",
  note: "",
};

function toInput(value: string): string | null {
  return value.trim() === "" ? null : value;
}

export function ClientFormPage() {
  const db = useDatabase();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const clientId = id ? Number(id) : null;

  const [form, setForm] = useState<ClientInput>(EMPTY);
  const [nameError, setNameError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clientId === null) return;
    void getClient(db, clientId).then((client) => {
      if (client) {
        setForm({
          name: client.name,
          contactName: client.contactName ?? "",
          postalCode: client.postalCode ?? "",
          address: client.address ?? "",
          phone: client.phone ?? "",
          email: client.email ?? "",
          note: client.note ?? "",
        });
      }
    });
  }, [db, clientId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.name.trim() === "") {
      setNameError("顧客名を入力してください");
      return;
    }
    setNameError(null);
    setSaving(true);
    setErrorMessage(null);

    const input: ClientInput = {
      name: form.name.trim(),
      contactName: toInput(form.contactName ?? ""),
      postalCode: toInput(form.postalCode ?? ""),
      address: toInput(form.address ?? ""),
      phone: toInput(form.phone ?? ""),
      email: toInput(form.email ?? ""),
      note: toInput(form.note ?? ""),
    };

    const result =
      clientId === null ? await createClient(db, input) : await updateClient(db, clientId, input);
    setSaving(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    void navigate("/clients");
  }

  return (
    <div>
      <h1>{clientId === null ? "新しい顧客を登録" : "顧客情報を編集"}</h1>
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <Field label="顧客名" htmlFor="client-name" required error={nameError ?? undefined}>
          <input
            id="client-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="担当者名" htmlFor="client-contact">
          <input
            id="client-contact"
            value={form.contactName ?? ""}
            onChange={(event) => setForm({ ...form, contactName: event.target.value })}
          />
        </Field>
        <Field label="郵便番号" htmlFor="client-postal">
          <input
            id="client-postal"
            value={form.postalCode ?? ""}
            onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
          />
        </Field>
        <Field label="住所" htmlFor="client-address">
          <input
            id="client-address"
            value={form.address ?? ""}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </Field>
        <Field label="電話番号" htmlFor="client-phone">
          <input
            id="client-phone"
            value={form.phone ?? ""}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </Field>
        <Field label="メールアドレス" htmlFor="client-email">
          <input
            id="client-email"
            type="email"
            value={form.email ?? ""}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>
        <Field label="備考" htmlFor="client-note">
          <textarea
            id="client-note"
            value={form.note ?? ""}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </Field>
        <button type="submit" disabled={saving}>
          {saving ? "保存中…" : "保存する"}
        </button>
      </form>
    </div>
  );
}
