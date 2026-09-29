// What the member is told with a decision (statement of reasons): the reason category, required, with
// the part of the terms it applies, and an optional note sent to them as written. The internal reason
// stays in the form around it, for the audit log only.
import { ExternalLinkIcon } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { categoryLabel, DETAILS_MAX, termsSection, type Statement } from "~/lib/reasons";
import { useRoot } from "./root-data";

/** Filled in: a category chosen, and a note that fits. */
export function statementReady(value: Statement): boolean {
  return Boolean(value.category) && (value.details ?? "").trim().length <= DETAILS_MAX;
}

/**
 * The category select and the note, controlled. Posted as `category` and `details` when inside a form
 * that posts to /act.
 */
export function StatementFields({ id, value, onChange }: { id: string; value: Statement; onChange: (value: Statement) => void }) {
  const { reasonCategories } = useRoot();
  const chosen = reasonCategories.find((c) => c.id === value.category);
  const terms = chosen ? termsSection(chosen.termsSection) : null;
  const details = value.details ?? "";
  return (
    <>
      <Field data-invalid={reasonCategories.length === 0 || undefined}>
        <FieldLabel htmlFor={`${id}-category`}>Reason they're told</FieldLabel>
        <Select value={value.category ?? ""} onValueChange={(category) => onChange({ ...value, category })}>
          <SelectTrigger id={`${id}-category`} className="w-full" aria-invalid={reasonCategories.length === 0 || undefined}>
            <SelectValue placeholder="Choose the rule it breaks" />
          </SelectTrigger>
          <SelectContent position="popper">
            {reasonCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {categoryLabel(c.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="category" value={value.category ?? ""} />
        {reasonCategories.length === 0 ? (
          <FieldError>The reason categories couldn't be read. Reload the page before deciding.</FieldError>
        ) : (
          <FieldDescription>
            Sent to them by email in their language, with the part of the terms it falls under
            {terms && (
              <>
                {": "}
                <a href={terms.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1">
                  {terms.label}
                  <ExternalLinkIcon className="size-3" aria-hidden />
                </a>
              </>
            )}
            .
          </FieldDescription>
        )}
      </Field>
      <Field data-invalid={details.length > DETAILS_MAX || undefined}>
        <FieldLabel htmlFor={`${id}-details`}>
          Note for them <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Textarea
          id={`${id}-details`}
          name="details"
          rows={3}
          maxLength={DETAILS_MAX}
          value={details}
          onChange={(e) => onChange({ ...value, details: e.target.value })}
          placeholder="What they should know about this decision"
        />
        <FieldDescription className="flex justify-between gap-4">
          <span>Sent to the member as written, without translation: write it in their language.</span>
          <span className="shrink-0 tabular-nums">
            {details.length}/{DETAILS_MAX}
          </span>
        </FieldDescription>
      </Field>
    </>
  );
}
