import { Input, Checkbox, Select } from "../ui";

/**
 * Generic schema-driven authoring form (authoring-model #6): renders one input per field of
 * a Brick's Zod `configSchema`, so a new Brick gets an authoring form for free. Handles the
 * common field kinds (string / number / boolean / enum / string[]); a Brick whose config
 * needs more (e.g. the question's answer-shape) supplies a custom `Authoring` view instead.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type ZodNode = any;

interface Field {
  name: string;
  node: ZodNode;
  isOptional: boolean;
}

/** Peel Optional/Nullable/Default wrappers off to the inner type. */
function unwrap(node: ZodNode): { node: ZodNode; isOptional: boolean } {
  let isOptional = false;
  let cur = node;
  while (["ZodOptional", "ZodNullable", "ZodDefault"].includes(cur?._def?.typeName)) {
    if (cur._def.typeName !== "ZodDefault") {
      isOptional = true;
    }
    cur = cur._def.innerType;
  }
  return { node: cur, isOptional };
}

function fieldsOf(schema: ZodNode): Field[] {
  if (schema?._def?.typeName !== "ZodObject") {
    return [];
  }
  return Object.entries(schema._def.shape() as Record<string, ZodNode>).map(([name, raw]) => {
    const { node, isOptional } = unwrap(raw);
    return { name, node, isOptional };
  });
}

const humanize = (name: string): string =>
  name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export function SchemaForm({
  schema,
  config,
  onChange,
}: {
  schema: ZodNode;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  const set = (name: string, value: unknown) => {
    const next = { ...config };
    if (value === undefined || value === "") {
      delete next[name];
    } else {
      next[name] = value;
    }
    onChange(next);
  };

  const fields = fieldsOf(schema);
  if (fields.length === 0) {
    return <p className="text-muted-foreground text-sm">No editable fields.</p>;
  }

  return (
    <div className="space-y-3">
      {fields.map(({ name, node, isOptional }) => {
        const typeName: string = node?._def?.typeName;
        const label = `${humanize(name)}${isOptional ? "" : " *"}`;
        const value = config[name];

        if (typeName === "ZodBoolean") {
          return (
            <label key={name} className="flex items-center gap-3">
              <Checkbox checked={Boolean(value)} onChange={(e) => set(name, e.target.checked)} />
              <span className="text-sm">{label}</span>
            </label>
          );
        }
        if (typeName === "ZodEnum") {
          const values: string[] = node._def.values;
          return (
            <div key={name}>
              <label className="text-muted-foreground block text-sm">{label}</label>
              <Select value={value ?? values[0]} onChange={(e) => set(name, e.target.value)}>
                {values.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          );
        }
        if (typeName === "ZodNumber") {
          return (
            <div key={name}>
              <label className="text-muted-foreground block text-sm">{label}</label>
              <Input
                type="number"
                value={value ?? ""}
                onChange={(e) => set(name, e.target.value === "" ? undefined : Number(e.target.value))}
              />
            </div>
          );
        }
        if (typeName === "ZodString") {
          return (
            <div key={name}>
              <label className="text-muted-foreground block text-sm">{label}</label>
              <Input value={value ?? ""} onChange={(e) => set(name, e.target.value)} />
            </div>
          );
        }
        // Richer shapes (arrays, unions, nested objects) → the Brick supplies a custom
        // Authoring view; the generic form just flags the field.
        return (
          <p key={name} className="text-muted-foreground text-sm">
            {humanize(name)}: needs a custom authoring view.
          </p>
        );
      })}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
