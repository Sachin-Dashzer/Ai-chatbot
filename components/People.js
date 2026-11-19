// The People screen: who the bot can reach, and the three things Ankit does to that list.
//
// It follows the app-screen rules the rest of these boards follow: the table is rules and
// alignment, with a grey sentence-case header on no fill band, no zebra, the name column widest
// and in ink while everything else is grey, numbers right-aligned in tabular figures, one status
// mark per row, and one ghost action in a fixed trailing column at the same pitch on every row.
// The forms put the label above the field, keep the inputs white on the panel's grey, and leave
// the destructive action for last in a section of its own with its consequence in words.
import { Icon, Panel, Section, Empty } from "./ui";
import { PageHead } from "./Shell";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// A phone number is an identifier, so it is set in the mono face at body size, like a task id.
const Number_ = ({ children }) => (
  <span className="font-mono text-meta tabular text-muted">{children}</span>
);

function Field({ label, name, defaultValue = "", placeholder, hint, required = false, children }) {
  const id = `${name}-${label.replace(/\s+/g, "-")}`;
  return (
    <p className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-body font-medium text-ink">{label}</label>
      {children ? (
        children(id)
      ) : (
        <input
          id={id} name={name} defaultValue={defaultValue} placeholder={placeholder} required={required}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="h-10 w-full rounded-control border border-[var(--control)] bg-[var(--surface)] px-2.5 text-body text-ink placeholder:text-faint focus-visible:border-ink"
        />
      )}
      {hint && <span id={`${id}-hint`} className="mt-1.5 block text-small text-faint">{hint}</span>}
    </p>
  );
}

const Primary = ({ children }) => (
  <button className="press inline-flex h-10 flex-none items-center rounded-control bg-ink px-3.5 text-body font-medium text-[var(--surface)]">
    {children}
  </button>
);

// ── The table ────────────────────────────────────────────────────────────
function Row({ p, boardKey, open }) {
  const href = open
    ? `/board/${boardKey}?tab=people`
    : `/board/${boardKey}?tab=people&who=${encodeURIComponent(p.name)}`;
  return (
    <tr className="border-t border-rule">
      <td className="py-2.5 pr-3 align-top">
        <a
          href={href}
          className="press block truncate text-body font-medium text-ink underline-offset-2 hover:underline"
        >
          {p.name}
        </a>
        {p.aliases && <span className="mt-0.5 block truncate text-small text-muted">also {p.aliases}</span>}
      </td>
      <td className="py-2.5 pr-3 align-top"><Number_>{p.phone}</Number_></td>
      <td className="py-2.5 pr-3 align-top text-body text-muted">
        {p.reports}
        {!p.reminder && <span className="mt-0.5 block text-small text-faint">no 7 PM reminder</span>}
      </td>
      <td className="py-2.5 pr-3 text-right align-top text-body tabular text-ink">{p.open}</td>
      <td className="py-2.5 pr-3 align-top">
        {p.lastIn ? (
          <span className="text-small tabular text-faint">{p.lastIn}</span>
        ) : (
          <span
            title="They have never messaged the bot, so WhatsApp allows only the approved template until they reply"
            className="inline-flex h-5 flex-none items-center whitespace-nowrap rounded-chip bg-[var(--pill-warning-bg)] px-1.5 text-small font-medium text-[var(--pill-warning-ink)]"
          >
            never messaged
          </span>
        )}
      </td>
      <td className="py-2 pl-0 text-right align-top">
        <a
          href={href}
          aria-current={open ? "true" : undefined}
          className={`press inline-flex h-7 flex-none items-center whitespace-nowrap rounded-control border px-2 text-meta ${
            open ? "border-ink bg-ink text-[var(--surface)]" : "border-[var(--control)] text-muted hover:border-ink hover:text-ink"
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
    ? `${people.length === 1 ? "One person" : `${people.length} people`} on the list, ${reach} of them reachable by plain message right now.`
    : "Nobody on the list yet. Add the first person below.";

  return (
    <>
      <PageHead title="People" finding={finding} stamp={`Updated ${data.updated}`} />

      {/* The answer to whatever was just submitted, in the words the bot would have used. */}
      {(ok || err) && (
        <p
          role="status"
          className="mb-5 whitespace-pre-line rounded-card px-3 py-2.5 text-body"
          style={
            err
              ? { background: "var(--pill-negative-bg)", color: "var(--pill-negative-ink)" }
              : { background: "var(--pill-positive-bg)", color: "var(--pill-positive-ink)" }
          }
        >
          {err || ok}
        </p>
      )}

      <Panel
        title="The team"
        count={`${people.length} on the list`}
        note={
          <>
            Everyone here gets tasks the moment you send them, their pending list twice a day, and the
            7 PM reminder. Removing someone stops all of it and keeps everything they have already done.
          </>
        }
        pad={false}
      >
        {people.length === 0 ? (
          <div className="px-4 py-4 sm:px-5"><Empty>Nobody on the list. The first person you add can be sent a task straight away.</Empty></div>
        ) : (
          <div className="overflow-x-auto px-4 pb-1 sm:px-5">
            <table className="w-full min-w-[46rem] text-body">
              <thead>
                <tr className="text-small text-faint">
                  <th scope="col" className="w-[26%] pb-2 pt-3 pr-3 text-left font-normal">Name</th>
                  <th scope="col" className="pb-2 pt-3 pr-3 text-left font-normal">WhatsApp number</th>
                  <th scope="col" className="pb-2 pt-3 pr-3 text-left font-normal">Reports</th>
                  <th scope="col" className="pb-2 pt-3 pr-3 text-right font-normal">Open</th>
                  <th scope="col" className="pb-2 pt-3 pr-3 text-left font-normal">Last message</th>
                  <th scope="col" className="pb-2 pt-3" />
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

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div className="grid min-w-0 content-start gap-6">
        {/* Editing is one person at a time, chosen from the table, so the fields always say
            whose they are. */}
        {selected ? (
          <Panel title={selected.name} count={selected.phone}>
            <form method="post" action={`/board/${boardKey}/people`} className="grid gap-4">
              <input type="hidden" name="action" value="save" />
              <input type="hidden" name="who" value={selected.name} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" name="name" defaultValue={selected.name} required />
                <Field
                  label="WhatsApp number" name="phone" defaultValue={selected.phone} required
                  hint="A new number has never messaged the bot, so send start to open its window."
                />
                <Field
                  label="Other names" name="aliases" defaultValue={selected.aliases}
                  placeholder="CA Rahul, Rahul ji"
                  hint="What you call them in a voice note, so the bot assigns to the right person."
                />
              </div>
              <div className="flex items-center gap-3">
                <Primary>Save changes</Primary>
                <a
                  href={`/board/${boardKey}?tab=people`}
                  className="press inline-flex h-10 items-center rounded-control px-2 text-body text-muted hover:text-ink"
                >
                  Cancel
                </a>
              </div>
            </form>

            {/* Last, in its own section, naming the person and what it does. */}
            <div className="mt-5 border-t border-edge pt-4">
              <h3 className="text-body font-medium text-ink">Remove {selected.name}</h3>
              <p className="mt-1 text-body text-muted">
                Nothing more reaches them: no tasks, no pending list, no reminder. Their messages, closed
                tasks and remarks stay on every board, and you can add them back with the same number.
                {selected.open > 0 && ` They still have ${plural(selected.open, "task")} open — close or reassign ${selected.open === 1 ? "it" : "them"} first.`}
              </p>
              <form method="post" action={`/board/${boardKey}/people`} className="mt-3">
                <input type="hidden" name="action" value="remove" />
                <input type="hidden" name="who" value={selected.name} />
                <button className="press inline-flex h-9 items-center rounded-control border border-[var(--negative)] px-3 text-body font-medium text-[var(--negative)] hover:bg-[var(--pill-negative-bg)]">
                  Remove {selected.name}
                </button>
              </form>
            </div>
          </Panel>
        ) : (
          <Panel title="Add someone">
            <form method="post" action={`/board/${boardKey}/people`} className="grid gap-4">
              <input type="hidden" name="action" value="add" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" name="name" placeholder="Rahul" required />
                <Field
                  label="WhatsApp number" name="phone" placeholder="919812345678" required
                  hint="With the country code. A ten-digit number takes yours."
                />
                <Field
                  label="Other names" name="aliases" placeholder="CA Rahul, Rahul ji"
                  hint="Optional. What you call them in a voice note."
                />
              </div>
              <div>
                <Primary>Add to the team</Primary>
              </div>
            </form>
          </Panel>
        )}

          <Section title="You">
            <div className="rounded-card border border-edge px-4 py-3">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-body font-medium text-ink">{owner.name}</span>
                <Number_>{owner.phone}</Number_>
              </p>
              <p className="mt-1 text-body text-muted">
                The owner is set in <span className="font-mono text-meta">people.yaml</span>{/* taste-skill-ignore: a real filename */} and
                cannot be changed from here or from WhatsApp: a wrong number in this one field would lock
                you out of your own bot.
              </p>
            </div>
          </Section>
        </div>

        <div className="grid min-w-0 content-start gap-6">
          <Panel title="What happens when you add someone">
            <ol className="grid gap-3">
              {[
                ["They are known from that moment", "The bot ignores numbers that are not on this list, so until they are added their messages go nowhere. Nothing needs restarting."],
                ["The first task opens WhatsApp's window", "Outside 24 hours WhatsApp allows only the approved template, so the bot sends that with the task in it and releases the full message the moment they reply."],
                ["Or open it yourself first", "Send start and their name to the bot, and they can be messaged plainly from their reply on."],
              ].map(([head, body]) => (
                <li key={head}>
                  <span className="block text-body font-medium text-ink">{head}</span>
                  <span className="mt-0.5 block text-body text-muted">{body}</span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="From WhatsApp instead" pad={false}>
            <dl className="divide-y divide-rule">
              {[
                ["people", "the list with every number"],
                ["add Rahul 919812345678", "add someone"],
                ["edit Rahul phone 919...", "change phone, name or aliases"],
                ["remove Rahul", "stop everything reaching them"],
              ].map(([cmd, what]) => (
                <div key={cmd} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 sm:px-5">
                  <dt className="font-mono text-meta text-ink">{cmd}{/* taste-skill-ignore: literal WhatsApp commands */}</dt>
                  <dd className="text-small text-muted">{what}</dd>
                </div>
              ))}
            </dl>
          </Panel>

        </div>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-small text-faint">
        <Icon.user width={14} height={14} className="text-[var(--accent)]" />
        Changes here reach WhatsApp within a few seconds — nothing to restart or deploy.
      </p>
    </>
  );
}
