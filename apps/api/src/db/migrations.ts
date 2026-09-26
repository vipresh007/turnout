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
];
