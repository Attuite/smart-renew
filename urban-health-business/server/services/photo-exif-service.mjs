function emptyExif(reason) {
  return {
    found: false,
    capturedAt: null,
    capturedAtOriginal: null,
    timezoneStatus: null,
    coordinates: null,
    coordinateCrs: null,
    reason
  };
}

function parseExifDate(value) {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(value || '').trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}` : null;
}

function parseTiff(buffer, base, end) {
  if (base + 8 > end) return emptyExif('invalid_tiff_header');
  const byteOrder = buffer.toString('ascii', base, base + 2);
  const little = byteOrder === 'II';
  if (!little && byteOrder !== 'MM') return emptyExif('invalid_tiff_byte_order');
  const u16 = (offset) => {
    if (offset < base || offset + 2 > end) throw new RangeError('EXIF_OUT_OF_RANGE');
    return little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  };
  const u32 = (offset) => {
    if (offset < base || offset + 4 > end) throw new RangeError('EXIF_OUT_OF_RANGE');
    return little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  };
  if (u16(base + 2) !== 42) return emptyExif('invalid_tiff_magic');

  const typeSizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const readIfd = (relativeOffset) => {
    const offset = base + relativeOffset;
    const count = u16(offset);
    if (count > 512 || offset + 2 + count * 12 + 4 > end) throw new RangeError('EXIF_IFD_INVALID');
    const entries = new Map();
    for (let index = 0; index < count; index += 1) {
      const entryOffset = offset + 2 + index * 12;
      entries.set(u16(entryOffset), {
        type: u16(entryOffset + 2),
        count: u32(entryOffset + 4),
        entryOffset
      });
    }
    return entries;
  };
  const valueOffset = (entry) => {
    const byteLength = (typeSizes[entry.type] || 0) * entry.count;
    if (!byteLength || byteLength > 1024 * 1024) throw new RangeError('EXIF_VALUE_INVALID');
    const offset = byteLength <= 4 ? entry.entryOffset + 8 : base + u32(entry.entryOffset + 8);
    if (offset < base || offset + byteLength > end) throw new RangeError('EXIF_VALUE_OUT_OF_RANGE');
    return { offset, byteLength };
  };
  const ascii = (entry) => {
    if (!entry || entry.type !== 2) return '';
    const { offset, byteLength } = valueOffset(entry);
    return buffer.toString('ascii', offset, offset + byteLength).replace(/\0+$/, '').trim();
  };
  const number = (entry) => {
    if (!entry || entry.count < 1) return null;
    const { offset } = valueOffset(entry);
    if (entry.type === 3) return u16(offset);
    if (entry.type === 4) return u32(offset);
    return null;
  };
  const rationals = (entry) => {
    if (!entry || entry.type !== 5) return [];
    const { offset } = valueOffset(entry);
    const values = [];
    for (let index = 0; index < entry.count; index += 1) {
      const numerator = u32(offset + index * 8);
      const denominator = u32(offset + index * 8 + 4);
      values.push(denominator ? numerator / denominator : NaN);
    }
    return values;
  };

  const ifd0 = readIfd(u32(base + 4));
  const exifPointer = number(ifd0.get(0x8769));
  const gpsPointer = number(ifd0.get(0x8825));
  const exifIfd = exifPointer == null ? new Map() : readIfd(exifPointer);
  const capturedAtOriginal = ascii(exifIfd.get(0x9003))
    || ascii(exifIfd.get(0x9004))
    || ascii(ifd0.get(0x0132))
    || null;
  const capturedAt = parseExifDate(capturedAtOriginal);

  let coordinates = null;
  if (gpsPointer != null) {
    const gps = readIfd(gpsPointer);
    const latitudeRef = ascii(gps.get(0x0001)).toUpperCase();
    const longitudeRef = ascii(gps.get(0x0003)).toUpperCase();
    const latitudeParts = rationals(gps.get(0x0002));
    const longitudeParts = rationals(gps.get(0x0004));
    if (
      latitudeParts.length >= 3
      && longitudeParts.length >= 3
      && latitudeParts.concat(longitudeParts).every(Number.isFinite)
      && ['N', 'S'].includes(latitudeRef)
      && ['E', 'W'].includes(longitudeRef)
    ) {
      let latitude = latitudeParts[0] + latitudeParts[1] / 60 + latitudeParts[2] / 3600;
      let longitude = longitudeParts[0] + longitudeParts[1] / 60 + longitudeParts[2] / 3600;
      if (latitudeRef === 'S') latitude *= -1;
      if (longitudeRef === 'W') longitude *= -1;
      if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
        coordinates = [longitude, latitude];
      }
    }
  }
  return {
    found: Boolean(capturedAt || coordinates),
    capturedAt,
    capturedAtOriginal,
    timezoneStatus: capturedAt ? 'unknown' : null,
    coordinates,
    coordinateCrs: coordinates ? 'WGS84' : null,
    reason: capturedAt || coordinates ? null : 'supported_tags_not_found'
  };
}

export function extractPhotoExif(buffer, mimeType) {
  if (mimeType !== 'image/jpeg') return emptyExif('mime_not_supported');
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return emptyExif('invalid_jpeg');
  }
  try {
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      const payloadStart = offset + 4;
      const segmentEnd = offset + 2 + length;
      if (segmentEnd > buffer.length) break;
      if (
        marker === 0xe1
        && payloadStart + 6 <= segmentEnd
        && buffer.toString('ascii', payloadStart, payloadStart + 6) === 'Exif\0\0'
      ) {
        return parseTiff(buffer, payloadStart + 6, segmentEnd);
      }
      offset = segmentEnd;
    }
    return emptyExif('exif_segment_not_found');
  } catch {
    return emptyExif('exif_parse_failed');
  }
}
