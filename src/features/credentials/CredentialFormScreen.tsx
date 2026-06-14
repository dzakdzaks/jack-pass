import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import { useVault } from "@/features/vault/vaultStore";
import { Button } from "@/ui/Button";
import { Field, Input, Textarea } from "@/ui/Input";
import { PasswordField } from "@/ui/PasswordField";
import { GeneratorPanel } from "@/features/generator/GeneratorPanel";
import { errorMessage } from "@/lib/errorMessage";

const schema = z.object({
  title: z.string().min(1, "Title is required."),
  username: z.string(),
  password: z.string(),
  url: z
    .string()
    .refine((v) => v === "" || /^https?:\/\//i.test(v) || !/\s/.test(v), "Enter a valid URL."),
  notes: z.string(),
  tags: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function CredentialFormScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useVault((s) => s.unlocked?.data.items.find((i) => i.id === id));
  const addItem = useVault((s) => s.addItem);
  const editItem = useVault((s) => s.editItem);
  const isEdit = Boolean(id);

  const [showGenerator, setShowGenerator] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: existing?.title ?? "",
      username: existing?.username ?? "",
      password: existing?.password ?? "",
      url: existing?.url ?? "",
      notes: existing?.notes ?? "",
      tags: existing?.tags.join(", ") ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    const tags = values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const draft = {
      title: values.title,
      username: values.username,
      password: values.password,
      url: values.url,
      notes: values.notes,
      tags,
      favorite: existing?.favorite ?? false,
    };
    try {
      if (isEdit && id) {
        await editItem(id, draft);
        navigate(`/credentials/${id}`);
      } else {
        await addItem(draft);
        navigate("/");
      }
    } catch (err) {
      setSubmitError(errorMessage(err, "Could not save credential."));
    }
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-[24px] p-[24px]">
      <h1 className="text-[24px] font-normal tracking-[-0.4px] text-ink">
        {isEdit ? "Edit credential" : "Add credential"}
      </h1>

      <form className="flex flex-col gap-[16px]" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Title" htmlFor="title" error={errors.title?.message}>
          <Input id="title" autoFocus {...register("title")} />
        </Field>
        <Field label="Username / email" htmlFor="username">
          <Input id="username" autoComplete="off" {...register("username")} />
        </Field>

        <Field label="Password" htmlFor="password">
          <div className="flex flex-col gap-[8px]">
            <PasswordField id="password" autoComplete="off" {...register("password")} />
            <button
              type="button"
              onClick={() => setShowGenerator((v) => !v)}
              className="self-start text-[13px] font-semibold text-primary"
            >
              {showGenerator ? "Hide generator" : "Generate password"}
            </button>
            {showGenerator && (
              <GeneratorPanel
                onUse={(pw) => {
                  setValue("password", pw, { shouldDirty: true });
                  setShowGenerator(false);
                }}
                seed={watch("password")}
              />
            )}
          </div>
        </Field>

        <Field label="Website URL" htmlFor="url" error={errors.url?.message}>
          <Input id="url" inputMode="url" placeholder="https://" {...register("url")} />
        </Field>
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" {...register("notes")} />
        </Field>
        <Field label="Tags" htmlFor="tags" hint="Comma-separated, e.g. work, banking">
          <Input id="tags" {...register("tags")} />
        </Field>

        {submitError && <p className="text-[13px] text-semantic-down">{submitError}</p>}

        <div className="flex gap-[12px]">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={() => navigate(isEdit && id ? `/credentials/${id}` : "/")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
