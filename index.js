'use strict';

const fs = require('fs');
const hexy = require('hexy');
const child_process = require('child_process');
const { crc32 } = require('crc');

async function collider() {
    const opts = ['raw-old.bin', 'raw-new.bin'];
    return await new Promise((resolve, reject) => {
        const im = child_process.spawn('./crc32-file-collision-generator/matchfile', opts);
        let databuf = Buffer.from([]);

        im.stdout.on('data', (data) => {
            databuf = Buffer.concat([databuf, data]);
        });

        im.stderr.on('data', (data) => {
            console.log(data.toString());
        });

        im.on('close', (code) => {
            if (code != 0) {
                reject(new Error('collider failed!'));
            } else {
                resolve(databuf);
            }
        });
    });
}

async function main() {
    const file = fs.readFileSync(process.argv[2]);

    const header = file.slice(0, 0x40);
    const body = file.slice(0x40);

    const header_crc = header.readUInt32BE(0x04);
    const size = header.readUInt32BE(0x0c);
    const crc = header.readUInt32BE(0x18);

    const header_tmp = Buffer.allocUnsafe(0x40);

    header.copy(header_tmp);

    header_tmp.writeUInt32BE(0, 0x04);

    let new_header_crc = crc32(header_tmp);
    const new_body_crc = crc32(body);
    const new_body_len = body.length;

    console.log(crc.toString(16));
    console.log(new_body_crc.toString(16));

    console.log(header_crc.toString(16));
    console.log(new_header_crc.toString(16));

    console.log(size);
    console.log(new_body_len);

    let flag = 0;

    if (crc != new_body_crc) {
        console.log('Body CRC mismatch!');
        flag = 1;
    }

    if (header_crc != new_header_crc) {
        console.log('Header CRC mismatch!');
        flag = 1;
    }

    if (flag === 1) {
        for(let i = 0x20; i < 0x40; i++) {
            header_tmp[i] = 0x00;
        }

        fs.writeFileSync('raw-old.bin', file.slice(0x40, size + 0x40));
        fs.writeFileSync('raw-new.bin', body);

        // Collide!!!
        const bytes = await collider();

        console.log('Collider says:');
        console.log(hexy.hexy(bytes, {format: 'twos'}));

        // Allocate new buffeer
        const newfile = Buffer.allocUnsafe(file.length + bytes.length);
        file.copy(newfile);
        bytes.copy(newfile, file.length);

        header_tmp.write('W2914NS-V2(0.0.0)', 0x20);

        new_header_crc = crc32(header_tmp);
        header_tmp.writeUInt32BE(new_header_crc, 0x04);

        console.log(hexy.hexy(header, {format: 'twos'}));
        console.log(hexy.hexy(header_tmp, {format: 'twos'}));

        header_tmp.copy(newfile);

        fs.writeFileSync(`${process.argv[2]}.wevofw`, newfile);
    } else {
        console.log('It is already wevo fw.');
    }
}

main();
