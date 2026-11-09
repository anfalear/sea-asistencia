-- ============================================================
--  SEA Matemáticas UIS · Reserva de sesiones de tutoría en tablero
--  Convocatoria de tutores 2027-1 (10, 11 y 12 de noviembre de 2026)
--
--  Las tablas no tienen políticas RLS: el público (anon) NO puede leerlas
--  ni escribirlas directamente. Todo pasa por funciones SECURITY DEFINER:
--    tablero_info(token)                      -> datos del candidato + franjas
--    tablero_reservar(token, asignatura, slot) -> reserva o cambia la franja
--    tablero_cancelar(token, asignatura)       -> libera la franja
--    tablero_agenda(clave)                     -> agenda completa (coordinación)
--  Los datos de los candidatos se cargan aparte (no se versionan en el repo).
-- ============================================================

create table if not exists tablero_candidatos (
  token        text primary key,
  codigo       text not null,
  nombre       text not null,
  correo       text,
  asignaturas  text[] not null,
  permitidos   text[]            -- null = todas las franjas
);

create table if not exists tablero_reservas (
  id          bigserial primary key,
  token       text not null references tablero_candidatos(token) on delete cascade,
  asignatura  text not null,
  slot        text not null unique,          -- 'YYYY-MM-DDTHH:MM' (hora de Colombia)
  creado      timestamptz not null default now(),
  unique (token, asignatura)
);

create table if not exists tablero_config (
  clave_hash text not null
);

alter table tablero_candidatos enable row level security;
alter table tablero_reservas   enable row level security;
alter table tablero_config     enable row level security;
revoke all on tablero_candidatos, tablero_reservas, tablero_config from anon, authenticated;

-- Franjas válidas (cada 20 min, sesión de 15), según disponibilidad del evaluador:
--   martes 10: 10:00-12:00 · miércoles 11: 12:00-14:00 · jueves 12: 9:00-14:00
create or replace function tablero_slots() returns setof text
language sql immutable as $$
  select to_char(d + make_interval(mins => m), 'YYYY-MM-DD"T"HH24:MI')
  from (values ('2026-11-10'::timestamp, 600, 700),
               ('2026-11-11'::timestamp, 720, 820),
               ('2026-11-12'::timestamp, 540, 820)) v(d, ini, ult),
       generate_series(ini, ult, 20) m
  order by 1
$$;

create or replace function tablero_info(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare c tablero_candidatos;
begin
  select * into c from tablero_candidatos where token = p_token;
  if not found then return json_build_object('ok', false, 'error', 'enlace_invalido'); end if;
  return json_build_object(
    'ok', true,
    'nombre', c.nombre,
    'codigo', c.codigo,
    'asignaturas', c.asignaturas,
    'permitidos', coalesce(c.permitidos, array(select tablero_slots())),
    'ocupados', coalesce((select json_agg(slot) from tablero_reservas where token <> p_token), '[]'::json),
    'mias', coalesce((select json_object_agg(asignatura, slot) from tablero_reservas where token = p_token), '{}'::json),
    'ahora', to_char(now() at time zone 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI')
  );
end $$;

create or replace function tablero_reservar(p_token text, p_asignatura text, p_slot text) returns json
language plpgsql security definer set search_path = public as $$
declare c tablero_candidatos;
begin
  select * into c from tablero_candidatos where token = p_token;
  if not found then return json_build_object('ok', false, 'error', 'enlace_invalido'); end if;
  if not (p_asignatura = any(c.asignaturas)) then return json_build_object('ok', false, 'error', 'asignatura'); end if;
  if not (p_slot in (select tablero_slots())) then return json_build_object('ok', false, 'error', 'franja'); end if;
  if c.permitidos is not null and not (p_slot = any(c.permitidos)) then
    return json_build_object('ok', false, 'error', 'cruce_horario'); end if;
  -- se debe reservar con al menos 2 horas de anticipación
  if (p_slot || ':00')::timestamp < (now() at time zone 'America/Bogota') + interval '2 hours' then
    return json_build_object('ok', false, 'error', 'muy_tarde'); end if;
  delete from tablero_reservas where token = p_token and asignatura = p_asignatura;
  begin
    insert into tablero_reservas(token, asignatura, slot) values (p_token, p_asignatura, p_slot);
  exception when unique_violation then
    return json_build_object('ok', false, 'error', 'ocupado');
  end;
  return json_build_object('ok', true);
end $$;

create or replace function tablero_cancelar(p_token text, p_asignatura text) returns json
language plpgsql security definer set search_path = public as $$
begin
  delete from tablero_reservas r
   where r.token = p_token and r.asignatura = p_asignatura
     and (r.slot || ':00')::timestamp >= (now() at time zone 'America/Bogota') + interval '2 hours';
  return json_build_object('ok', true);
end $$;

create or replace function tablero_agenda(p_clave text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from tablero_config
                  where clave_hash = encode(sha256(convert_to(p_clave, 'UTF8')), 'hex')) then
    return json_build_object('ok', false, 'error', 'clave');
  end if;
  return json_build_object('ok', true,
    'reservas', coalesce((select json_agg(json_build_object(
        'slot', r.slot, 'asignatura', r.asignatura, 'codigo', c.codigo, 'nombre', c.nombre,
        'correo', c.correo, 'creado', r.creado) order by r.slot)
      from tablero_reservas r join tablero_candidatos c using (token)), '[]'::json),
    'pendientes', coalesce((select json_agg(json_build_object(
        'codigo', c.codigo, 'nombre', c.nombre, 'correo', c.correo, 'asignatura', a))
      from tablero_candidatos c, unnest(c.asignaturas) a
      where not exists (select 1 from tablero_reservas r where r.token = c.token and r.asignatura = a)), '[]'::json)
  );
end $$;

revoke all on function tablero_info(text), tablero_reservar(text, text, text),
                       tablero_cancelar(text, text), tablero_agenda(text) from public;
grant execute on function tablero_info(text), tablero_reservar(text, text, text),
                          tablero_cancelar(text, text), tablero_agenda(text) to anon, authenticated;
