#!/usr/bin/env bash
# ── Respaldo cifrado de las bases de datos ──
# Lo corre .github/workflows/respaldo-bases.yml cada noche.
#
# Variables (secrets en GitHub):
#   NEON_MARTHA_URL      Neon · Martha Rdz App (host SIN "-pooler")
#   NEON_TWC_URL         Neon · TWCApp (host SIN "-pooler")
#   SUPABASE_DB_URL      Supabase · JRDashboardSalones (Session pooler, puerto 5432)
#   RESPALDO_PASSPHRASE  contraseña con la que se cifra el respaldo
#
# Genera <carpeta>/respaldo-bases-<fecha>.tar.gpg: un .dump (formato custom de
# pg_dump) por base, empaquetados y cifrados con AES-256. El repo es público,
# así que nunca se sube nada sin cifrar.
# Si una base falla, respalda las demás y termina con error para que avise.

set -euo pipefail
umask 077

: "${RESPALDO_PASSPHRASE:?Falta el secret RESPALDO_PASSPHRASE}"

carpeta="${1:-.}"
fecha="$(date -u +%Y-%m-%d)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fallos=0

respaldar() {
  local nombre="$1" url="$2"
  shift 2
  local archivo="$tmp/$nombre.dump"

  if [ -z "$url" ]; then
    echo "::error::$nombre: falta su connection string en los secrets"
    fallos=$((fallos + 1))
    return 0
  fi

  if ! pg_dump "$url" --format=custom --no-owner --no-privileges "$@" --file "$archivo"; then
    echo "::error::$nombre: pg_dump falló"
    rm -f "$archivo"
    fallos=$((fallos + 1))
    return 0
  fi

  # Un respaldo sin datos de tablas no sirve aunque pg_dump no haya fallado
  local tablas
  tablas="$(pg_restore --list "$archivo" | grep -c ' TABLE DATA ' || true)"
  if [ "${tablas:-0}" -eq 0 ]; then
    echo "::error::$nombre: el respaldo no trae datos de ninguna tabla"
    rm -f "$archivo"
    fallos=$((fallos + 1))
    return 0
  fi

  echo "$nombre: $tablas tablas, $(du -h "$archivo" | cut -f1)"
}

respaldar martha "${NEON_MARTHA_URL:-}"
respaldar twc "${NEON_TWC_URL:-}"
respaldar dashboard "${SUPABASE_DB_URL:-}" --schema=public

if [ -z "$(ls -A "$tmp")" ]; then
  echo "::error::No se pudo respaldar ninguna base"
  exit 1
fi

destino="$carpeta/respaldo-bases-$fecha.tar.gpg"
tar -C "$tmp" -cf - . \
  | gpg --batch --yes --quiet --pinentry-mode loopback \
      --passphrase-file <(printf '%s' "$RESPALDO_PASSPHRASE") \
      --symmetric --cipher-algo AES256 --output "$destino"

# Comprobar que el archivo cifrado se puede abrir con la misma contraseña
gpg --batch --quiet --pinentry-mode loopback \
    --passphrase-file <(printf '%s' "$RESPALDO_PASSPHRASE") \
    --decrypt "$destino" | tar -tf - > /dev/null

echo "Respaldo cifrado: $destino ($(du -h "$destino" | cut -f1))"

if [ "$fallos" -gt 0 ]; then
  echo "::error::$fallos base(s) sin respaldar; revisa los errores de arriba"
  exit 1
fi
