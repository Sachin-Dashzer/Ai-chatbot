// People: who the bot can reach, and the three things Ankit does to that list.
//
// The table follows the app-screen rules — a 12px grey sentence-case header on
// no fill band, no zebra, one pitch, the identity column absorbing the slack
// while every other column is sized to its content (the previous build gave
// the name 26% and left a 300px dead band between "Reports" and "Open"),
// numbers right-aligned in tabular figures, and one ghost action in a fixed
// trailing column at the same pitch on every row.
//
// The forms follow the settings pattern: a label column carrying the section's
// name and what it does, beside the panel that does it. The destructive action
// is last, in a section of its own, with its consequence in words.
import { Panel, Empty, Notice, Button } from "./ui";
import { PageHead } from "./Shell";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// A phone number is an identifier, so it is set in the mono face, like a task
// id — not right-aligned, because it is not a quantity.
const Number_ = ({ children }) => (
  <span className="font-mono text-meta tabular text-muted">{children}</span>
);

function Field({ label, name, defaultValue = "", placeholder, hint, required = false }) {
  const id = `${name}-${label.replace(/\s+/g, "-")}`;
  return (
    <p className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-body font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-10 w-full rounded-control border border-[var(--control)] bg-surface px-3 text-body text-ink transition-colors duration-150 placeholder:text-faint hover:border-[var(--faint)] focus-visible:border-ink"
      />
      {hint && (
        <span id={`${id}-hint`} className="mt-2 block text-small leading-snug text-faint">
          {hint}
        </span>
      )}
    </p>
  );
}

// A settings row: what this section is, beside the panel that does it.
function FormSection({ title, description, children, className = "" }) {
  return (
    <section className={`grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8 ${className}`}>
      <div className="lg:pt-5">
        <h2 className="text-section font-semibold text-ink">{title}</h2>
        <p className="mt-1.5 max-w-[46ch] text-meta leading-snug text-muted">{description}</p>
      </div>
      <div className="min-w-0 rounded-card border border-edge bg-surface p-5">{children}</div>
    </section>
  );
}

// ── The table ────────────────────────────────────────────────────────────
function Row({ p, boardKey, open }) {
  const href = open
    ? `/board/${boardKey}?tab=people`
    : `/board/${boardKey}?tab=people&who=${encodeURIComponent(p.name)}`;
  return (
    <tr
      className={`press-row border-t border-rule ${open ? "bg-active" : "hover-row"}`}
      aria-current={open ? "true" : undefined}
    >
      <td className="py-3 pr-4 align-top">
        <a href={href} className="block truncate text-body font-medium text-ink hover:underline">
          {p.name}
        </a>
        {p.aliases && (
          <span className="mt-0.5 block truncate text-small text-faint">also {p.aliases}</span>
        )}
      </td>
      <td className="py-3 pr-4 align-top">
        <Number_>{p.phone}</Number_>
      </td>
      <td className="whitespace-nowrap py-3 pr-4 align-top text-meta text-muted">
        {p.reports}
        {!p.reminder && <span className="mt-0.5 block text-small text-faint">no 7 PM reminder</span>}
      </td>
      <td className="whitespace-nowrap py-3 pr-4 align-top">
        {p.lastIn ? (
          <span className="text-meta tabular text-muted">{p.lastIn}</span>
        ) : (
          <span
            title="They have never messaged the bot, so WhatsApp allows only the approved template until they reply"
            style={{ background: "var(--pill-warning-bg)", color: "var(--pill-warning-ink)" }}
            className="inline-flex h-5 flex-none items-center whitespace-nowrap rounded-chip px-1.5 text-small font-medium"
          >
            never messaged
          </span>
        )}
      </td>
      <td className="py-3 pr-4 text-right align-top text-body tabular">
        <span className={p.open ? "text-ink" : "text-faint"}>{p.open}</span>
      </td>
      <td className="py-2.5 text-right align-top">
        <a
          href={href}
          // Never filled: the row's own --active fill already says which person
          // is open, and the one near-black button on this screen is Save.
          className={`press inline-flex h-7 flex-none items-center whitespace-nowrap rounded-control border px-2.5 text-meta ${
            open
              ? "border-ink bg-surface font-medium text-ink"
              : "border-[var(--control)] bg-surface text-muted hover:bg-raised hover:text-ink"
          }`}
        >
          {open ? "Close" : "Edit"}
        </a>
      </td>
    </tr>
  );
}

export default function People({ data, boardKey, ok, err }) {
  const { people, selected, owner } = data;
  const reach = people.length - data.silent;
  const finding = people.length
    ? `${
        people.length === 1 ? "One person" : `${people.length} people`
      } on the list, ${reach} of them reachable by plain message right now.`
    : "Nobody on the list yet. Add the first person below.";

  return (
    <>
      <PageHead title="People" finding={finding} stamp={`Updated ${data.updated}`} />

      {/* The answer to whatever was just submitted, in the words the bot would
          have used. */}
      {(ok || err) && (
        <div className="mb-5">
          <Notice tone={err ? "negative" : "warning"}>
            <span className="whitespace-pre-line">{err || ok}</span>
          </Notice>
        </div>
      )}

      {/* Six short columns do not need 1130px, so the table pairs with the
          reference rail instead of stretching and leaving a dead band. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_316px]">
      <Panel
        title="The team"
        count={`${people.length} on the list`}
        note="Everyone here gets tasks the moment you send them, their pending list twice a day, and the 7 PM reminder. Removing someone stops all of it and keeps everything they have already done."
        pad={false}
      >
        {people.length === 0 ? (
          <div className="p-5">
            <Empty>
              Nobody on the list. The first person you add can be sent a task straight away.
            </Empty>
          </div>
        ) : (
          <div className="overflow-x-auto px-5 pb-1">
            {/* The name column takes w-full so it absorbs every spare pixel;
                each other column is sized to its own content. */}
            <table className="w-full min-w-[46rem] text-body">
              <thead>
                <tr className="text-small text-faint">
                  <th scope="col" className="w-full py-2.5 pr-4 text-left font-normal">Name</th>
                  <th scope="col" className="whitespace-nowrap py-2.5 pr-4 text-left font-normal">
                    WhatsApp number
                  </th>
                  <th scope="col" className="whitespace-nowrap py-2.5 pr-4 text-left font-normal">
                    Gets a list
                  </th>
                  <th scope="col" className="whitespace-nowrap py-2.5 pr-4 text-left font-normal">
                    Last message
                  </th>
                  <th scope="col" className="whitespace-nowrap py-2.5 pr-4 text-right font-normal">
                    Open
                  </th>
                  <th scope="col" className="py-2.5">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <Row key={p.name} p={p} boardKey={boardKey} open={selected?.name === p.name} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

        <div className="min-w-0 space-y-6">
          <Panel title="You" pad={false}>
            <div className="px-5 py-4">
              <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-body font-medium text-ink">{owner.name}</span>
                <Number_>{owner.phone}</Number_>
              </p>
              <p className="mt-2 text-meta leading-snug text-faint">
                {/* taste-skill-ignore: a real filename */}
                Set in <span className="font-mono">people.yaml</span> and not changeable from here
                or from WhatsApp: a wrong number in this one field would lock you out of your own
                bot.
              </p>
            </div>
          </Panel>

          <Panel title="From WhatsApp instead" pad={false}>
            <dl>
              {[
                ["people", "the list with every number"],
                ["add Rahul 919812345678", "add someone"],
                ["edit Rahul phone 919…", "change phone, name or aliases"],
                ["remove Rahul", "stop everything reaching them"],
              ].map(([cmd, what]) => (
                <div key={cmd} className="border-b border-rule px-5 py-2.5 last:border-0">
                  {/* taste-skill-ignore: literal WhatsApp commands */}
                  <dt className="font-mono text-meta text-ink">{cmd}</dt>
                  <dd className="mt-0.5 text-small text-faint">{what}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-edge px-5 py-2.5 text-small leading-snug text-faint">
              Changes either way reach WhatsApp within a few seconds — nothing to restart or deploy.
            </p>
          </Panel>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {/* Editing is one person at a time, chosen from the table, so the
            fields always say whose they are. */}
        {selected ? (
          <>
            <FormSection
              title={`Edit ${selected.name}`}
              description={`What the bot knows about ${selected.name}. The other names are what you call them in a voice note, so a task reaches the right person.`}
            >
              <form method="post" action={`/board/${boardKey}/people`}>
                <input type="hidden" name="action" value="save" />
                <input type="hidden" name="who" value={selected.name} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" name="name" defaultValue={selected.name} required />
                  <Field
                    label="WhatsApp number"
                    name="phone"
                    defaultValue={selected.phone}
                    required
                    hint="A new number has never messaged the bot, so send start to open its window."
                  />
                  <Field
                    label="Other names"
                    name="aliases"
                    defaultValue={selected.aliases}
                    placeholder="CA Rahul, Rahul ji"
                    hint="Optional. What you call them in a voice note."
                  />
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <Button kind="primary">Save changes</Button>
                  <Button as="a" kind="ghost" href={`/board/${boardKey}?tab=people`}>
                    Cancel
                  </Button>
                </div>
              </form>
            </FormSection>

            {/* Last, in its own section, naming the person and what it does. */}
            <FormSection
              title={`Remove ${selected.name}`}
              description="Nothing more reaches them: no tasks, no pending list, no reminder. Their messages, closed tasks and remarks stay on every board."
            >
              <p className="max-w-[62ch] text-body text-muted">
                You can add {selected.name} back with the same number at any time.
                {selected.open > 0 &&
                  ` They still have ${plural(selected.open, "task")} open — close or reassign ${
                    selected.open === 1 ? "it" : "them"
                  } first.`}
              </p>
              <form method="post" action={`/board/${boardKey}/people`} className="mt-4">
                <input type="hidden" name="action" value="remove" />
                <input type="hidden" name="who" value={selected.name} />
                <Button kind="danger">Remove {selected.name}</Button>
              </form>
            </FormSection>
          </>
        ) : (
          <FormSection
            title="Add someone"
            description="They are known from the moment you save. The bot ignores numbers that are not on this list, so until then their messages go nowhere — and nothing needs restarting."
          >
            <form method="post" action={`/board/${boardKey}/people`}>
              <input type="hidden" name="action" value="add" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" name="name" placeholder="Rahul" required />
                <Field
                  label="WhatsApp number"
                  name="phone"
                  placeholder="919812345678"
                  required
                  hint="With the country code. A ten-digit number takes yours."
                />
                <Field
                  label="Other names"
                  name="aliases"
                  placeholder="CA Rahul, Rahul ji"
                  hint="Optional. What you call them in a voice note."
                />
              </div>
              <div className="mt-5">
                <Button kind="primary">Add to the team</Button>
              </div>
            </form>
          </FormSection>
        )}

        <FormSection
          title="The first message"
          description="WhatsApp decides when a business may write to someone. This is what that means the first time you give a new person a task."
        >
          <ol className="grid gap-4">
            {[
              [
                "The first task opens WhatsApp's window",
                "Outside 24 hours WhatsApp allows only the approved template, so the bot sends that with the task inside it and releases the full message the moment they reply.",
              ],
              [
                "Or open it yourself first",
                "Send start and their name to the bot, and they can be messaged plainly from their reply on.",
              ],
            ].map(([head, body]) => (
              <li key={head}>
                <span className="block text-body font-medium text-ink">{head}</span>
                <span className="mt-1 block max-w-[68ch] text-body text-muted">{body}</span>
              </li>
            ))}
          </ol>
        </FormSection>

      </div>
    </>
  );
}
