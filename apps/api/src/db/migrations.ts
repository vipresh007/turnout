// Append-only: never edit a migration once it has shipped.
export const migrations: string[] = [
  `
  CREATE TABLE organizers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id text NOT NULL UNIQUE,
    email text,
    name text,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    organizer_id uuid NOT NULL REFERENCES organizers(id),
    name text NOT NULL,
    activity text,
    location text,
    weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time text NOT NULL,
    duration_minutes integer NOT NULL,
    timezone text NOT NULL,
    cap integer CHECK (cap IS NULL OR cap > 0),
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX groups_organizer_idx ON groups (organizer_id);

  CREATE TABLE members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX members_group_idx ON members (group_id);

  CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    starts_at timestamptz NOT NULL,
    cancelled boolean NOT NULL DEFAULT false,
    UNIQUE (group_id, starts_at)
  );

  CREATE TABLE rsvps (
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('in', 'out')),
    responded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, member_id)
  );
  `,
  // V2: reminders, notification channels, teams, payments
  `
  ALTER TABLE groups ADD COLUMN reminders jsonb NOT NULL DEFAULT '{"dayBefore": true, "hoursBefore": 2}';

  ALTER TABLE members ADD COLUMN skill smallint CHECK (skill BETWEEN 1 AND 5);
  ALTER TABLE members ADD COLUMN email text;
  ALTER TABLE members ADD COLUMN email_confirmed_at timestamptz;
  -- Capability token for the confirm and unsubscribe links in reminder emails.
  ALTER TABLE members ADD COLUMN email_token text UNIQUE;

  ALTER TABLE rsvps ADD COLUMN paid_at timestamptz;

  ALTER TABLE sessions ADD COLUMN teams jsonb;
  ALTER TABLE sessions ADD COLUMN last_reminded_at timestamptz;

  CREATE TABLE push_subscriptions (
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, endpoint)
  );

  -- One row per reminder actually sent, so the scheduled job never sends the same one twice.
  CREATE TABLE notifications_sent (
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    kind text NOT NULL,
    sent_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, member_id, kind)
  );
  `,
  // Email reminders no longer need a confirmation click; turn on anyone who was waiting on one.
  `UPDATE members SET email_confirmed_at = now() WHERE email IS NOT NULL AND email_confirmed_at IS NULL;`,
  // Recurrence: several days a week, every N weeks, start/end dates; per-week overrides.
  `
  ALTER TABLE groups ADD COLUMN weekdays smallint[];
  UPDATE groups SET weekdays = ARRAY[weekday];
  ALTER TABLE groups ALTER COLUMN weekdays SET NOT NULL;
  ALTER TABLE groups ADD COLUMN interval_weeks smallint NOT NULL DEFAULT 1 CHECK (interval_weeks BETWEEN 1 AND 4);
  ALTER TABLE groups ADD COLUMN starts_on date;
  UPDATE groups SET starts_on = created_at::date;
  ALTER TABLE groups ALTER COLUMN starts_on SET NOT NULL;
  ALTER TABLE groups ADD COLUMN ends_on date;
  -- weekday is superseded by weekdays; kept (nullable) so older rows and code paths stay valid.
  ALTER TABLE groups ALTER COLUMN weekday DROP NOT NULL;

  -- sessions.starts_at stays the scheduled time and identifies the week; overrides are this week only.
  ALTER TABLE sessions ADD COLUMN starts_at_override timestamptz;
  ALTER TABLE sessions ADD COLUMN location_override text;
  ALTER TABLE sessions ADD COLUMN note text;
  `,
  // Dropouts close to game time, for the organizer (and reliability later).
  `ALTER TABLE rsvps ADD COLUMN late_drop boolean NOT NULL DEFAULT false;`,
  // A member can be on several devices; one-time links restore a member on a new phone.
  `
  CREATE TABLE member_tokens (
    token_hash text PRIMARY KEY,
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  INSERT INTO member_tokens (token_hash, member_id) SELECT token_hash, id FROM members;
  CREATE INDEX member_tokens_member_idx ON member_tokens (member_id);
  -- members.token_hash is superseded by member_tokens.
  ALTER TABLE members ALTER COLUMN token_hash DROP NOT NULL;

  CREATE TABLE member_restores (
    token_hash text PRIMARY KEY,
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
  );
  `,
  // Optional cost per game: per player or a total split between everyone in, and how to pay.
  `
  ALTER TABLE groups ADD COLUMN fee_cents integer;
  ALTER TABLE groups ADD COLUMN fee_split boolean NOT NULL DEFAULT false;
  ALTER TABLE groups ADD COLUMN pay_note text;
  `,
];
