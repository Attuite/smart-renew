export function exifJpegFixture() {
  const tiff = Buffer.alloc(178);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  const entry = (offset, tag, type, count, value) => {
    tiff.writeUInt16LE(tag, offset);
    tiff.writeUInt16LE(type, offset + 2);
    tiff.writeUInt32LE(count, offset + 4);
    if (type === 2 && count <= 4) tiff.write(String(value), offset + 8, count, 'ascii');
    else tiff.writeUInt32LE(value, offset + 8);
  };
  tiff.writeUInt16LE(2, 8);
  entry(10, 0x8769, 4, 1, 38);
  entry(22, 0x8825, 4, 1, 76);
  tiff.writeUInt32LE(0, 34);
  tiff.writeUInt16LE(1, 38);
  entry(40, 0x9003, 2, 20, 56);
  tiff.writeUInt32LE(0, 52);
  tiff.write('2026:07:26 12:34:56\0', 56, 20, 'ascii');
  tiff.writeUInt16LE(4, 76);
  entry(78, 0x0001, 2, 2, 'N\0');
  entry(90, 0x0002, 5, 3, 130);
  entry(102, 0x0003, 2, 2, 'E\0');
  entry(114, 0x0004, 5, 3, 154);
  tiff.writeUInt32LE(0, 126);
  const rational = (offset, numerator, denominator = 1) => {
    tiff.writeUInt32LE(numerator, offset);
    tiff.writeUInt32LE(denominator, offset + 4);
  };
  rational(130, 34);
  rational(138, 16);
  rational(146, 12);
  rational(154, 108);
  rational(162, 57);
  rational(170, 0);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff]);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
    length,
    payload,
    Buffer.from([0xff, 0xd9])
  ]);
}
