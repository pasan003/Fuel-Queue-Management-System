<?php
declare(strict_types=1);

/**
 * GET — list all stations with queue + fuel flags (requires login session).
 */

require __DIR__ . '/config.php';

require_get();

$pdo = db();
if (!$pdo) {
    json_response(503, ['ok' => false, 'message' => 'Database unavailable']);
}

session_boot();
if (empty($_SESSION['user_id'])) {
    json_response(401, ['ok' => false, 'message' => 'Authentication required']);
}

$sql = <<<SQL
SELECT
  fs.station_id,
  fs.station_name,
  fs.location,
  COALESCE(qs.queue_length, 0) AS queue_length,
  COALESCE(qs.waiting_time, 0) AS waiting_time,
  qs.updated_at AS queue_updated_at,
  COALESCE(p.is_available, 0) AS petrol_raw,
  COALESCE(d.is_available, 0) AS diesel_raw,
  p.last_updated AS petrol_updated,
  d.last_updated AS diesel_updated
FROM fuel_stations fs
LEFT JOIN queue_status qs ON qs.station_id = fs.station_id
LEFT JOIN fuel_availability p ON p.station_id = fs.station_id AND p.fuel_type_id = 1
LEFT JOIN fuel_availability d ON d.station_id = fs.station_id AND d.fuel_type_id = 2
ORDER BY fs.station_name ASC
SQL;

$rows = $pdo->query($sql)->fetchAll();

/** Matches frontend dashboard status filters (available / limited / nofuel). */
function compute_station_status(bool $petrol, bool $diesel, int $queueLen): string {
    if (!$petrol && !$diesel) {
        return 'nofuel';
    }
    if ($petrol && $diesel && $queueLen < 10) {
        return 'available';
    }
    if (!$petrol || !$diesel || $queueLen >= 10) {
        return 'limited';
    }
    return 'available';
}

function max_iso(?string ...$dates): ?string {
    $best = null;
    foreach ($dates as $d) {
        if ($d === null || $d === '') {
            continue;
        }
        if ($best === null || strtotime($d) > strtotime($best)) {
            $best = $d;
        }
    }
    return $best;
}

$out = [];
foreach ($rows as $r) {
    $petrol = (bool)(int)$r['petrol_raw'];
    $diesel = (bool)(int)$r['diesel_raw'];
    $qLen = (int)$r['queue_length'];
    $status = compute_station_status($petrol, $diesel, $qLen);
    $lastIso = max_iso(
        $r['petrol_updated'] ?? null,
        $r['diesel_updated'] ?? null,
        $r['queue_updated_at'] ?? null
    );

    $out[] = [
        'station_id' => (int)$r['station_id'],
        'station_name' => (string)$r['station_name'],
        'location' => (string)($r['location'] ?? ''),
        'status' => $status,
        'petrol' => $petrol,
        'diesel' => $diesel,
        'queue_length' => $qLen,
        'waiting_time' => (int)$r['waiting_time'],
        'last_updated_iso' => $lastIso,
    ];
}

json_response(200, ['ok' => true, 'stations' => $out]);
