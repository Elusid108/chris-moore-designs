// One-off: seeds content/*.json (the CMS-managed source of truth) from the
// placeholder catalogue that previously lived in src/content/**/*.md.
// Safe to re-run: it overwrites content/*.json with the same fixed ids.
import { writeFileSync, mkdirSync } from 'node:fs';

const ID = {
  famPixelDecode: '3f4c1a9e-0d2b-4f6a-9c1e-2b7d8e5a1f01',
  famPixelPilot: '3f4c1a9e-0d2b-4f6a-9c1e-2b7d8e5a1f02',
  pxd8: 'b1d2c3e4-1111-4a5b-8c9d-0e1f2a3b4c01',
  pxd16: 'b1d2c3e4-1111-4a5b-8c9d-0e1f2a3b4c02',
  pxdMini: 'b1d2c3e4-1111-4a5b-8c9d-0e1f2a3b4c03',
  ppHat: 'b1d2c3e4-1111-4a5b-8c9d-0e1f2a3b4c04',
  bundle: 'b1d2c3e4-1111-4a5b-8c9d-0e1f2a3b4c05',
  fwPxd: 'c2e3d4f5-2222-4b6c-9d0e-1f2a3b4c5d01',
  fwPilot: 'c2e3d4f5-2222-4b6c-9d0e-1f2a3b4c5d02',
  swDesktop: 'd3f4e5a6-3333-4c7d-8e1f-2a3b4c5d6e01',
  swLithoLab: 'd3f4e5a6-3333-4c7d-8e1f-2a3b4c5d6e02',
  swPallet: 'd3f4e5a6-3333-4c7d-8e1f-2a3b4c5d6e03',
  swBorder: 'd3f4e5a6-3333-4c7d-8e1f-2a3b4c5d6e04',
  svLitho: 'e4a5f6b7-4444-4d8e-9f2a-3b4c5d6e7f01',
  svPcba: 'e4a5f6b7-4444-4d8e-9f2a-3b4c5d6e7f02',
  svInstall: 'e4a5f6b7-4444-4d8e-9f2a-3b4c5d6e7f03',
};
const now = '2026-09-29T00:00:00.000Z';
const p = (s) => `<p>${s}</p>`;
const specsData = (title, items) => [{ id: `${title.toLowerCase().replace(/\W+/g, '-')}-group`, title, items: items.map(([name, specs], i) => ({ id: `i${i + 1}`, name, qty: '', specs })) }];
const specsHtml = (groups) => groups.map((g) => `<h3>${g.title}</h3><dl>${g.items.map((i) => `<dt>${i.name}</dt><dd>${i.specs}</dd>`).join('')}</dl>`).join('');
const variant = (id, title, sku, price, optionName, inventory = 25) => ({ id, title, sku, price: price.toFixed(2), compareAt: null, options: { [optionName]: title }, inventory, shopifyVariantId: null });
const product = (o) => ({
  slugHistory: [], summary: '', description: '', specsData: [], specs: '', optionName: 'Title', variants: [], images: [], gallery: [], files: [],
  firmware: [], software: [], related: [], badges: { bestSeller: false, bundle: false }, featured: false, order: 100, status: 'active',
  shopify: { productId: null, handle: o.slug, hash: null, lastSyncedAt: null, lastError: null }, timestamp: now, ...o,
  specs: o.specsData ? specsHtml(o.specsData) : '',
});

const families = [
  { id: ID.famPixelDecode, slug: 'pixeldecode', name: 'PixelDecode', category: 'hardware', order: 1, portfolioSlug: 'mini-pyramid',
    tagline: 'ESP32-S3 pixel decoders that take an Art-Net/sACN/DDP stream and drive WS281x, SK6812 and APA102 pixels without a PC in the loop.',
    description: p('Custom PCBAs built around the ESP32-S3. Level-shifted outputs, fused power, 4- or 8-pin pixel headers and a USB-C console. Runs open firmware you can flash from the browser.'),
    heroImage: null, timestamp: now },
  { id: ID.famPixelPilot, slug: 'pixelpilot', name: 'PixelPilot', category: 'systems', order: 2, portfolioSlug: null,
    tagline: 'A Raspberry Pi control interface that schedules, previews and pushes shows to every PixelDecode board on the network.',
    description: p('A HAT plus SD image for a Raspberry Pi 4/5. Web UI on the local network, show scheduler, live preview, board discovery and OTA firmware updates for the whole fleet.'),
    heroImage: null, timestamp: now },
];

const products = [
  product({ id: ID.pxd8, slug: 'pxd-8', title: 'PXD-8 pixel decoder', sku: 'PXD-8', family: ID.famPixelDecode, order: 1, featured: true, badges: { bestSeller: true, bundle: false },
    summary: p('Eight fused, level-shifted outputs. Up to 4,096 pixels at 40 fps from Art-Net, sACN or DDP. Flash it from the browser, find it with PixelPilot.'),
    description: p('The board most people start with. Eight outputs cover a 16 × 16 matrix wall or a large lithophane lamp array.') + p('Every output is fused at 5 A and level-shifted to 5 V. Power comes in on a screw terminal at anything from 5 to 24 V, and the USB-C port doubles as a console and a flashing port.'),
    specsData: specsData('Specifications', [['MCU', 'ESP32-S3, 8 MB flash'], ['Outputs', '8 × 5 V level-shifted'], ['Max pixels', '4,096 (512/output @ 40 fps)'], ['Protocols', 'Art-Net, sACN (E1.31), DDP, WLED-compatible'], ['Input power', '5–24 V DC screw terminal, USB-C console'], ['Dimensions', '80 × 50 mm, M3 corners']]),
    optionName: 'Outputs', variants: [variant('v-pxd8-8', '8 ch', 'PXD-8', 89, 'Outputs')],
    firmware: [ID.fwPxd], software: [ID.swDesktop], related: [ID.pxd16, ID.pxdMini, ID.bundle] }),
  product({ id: ID.pxd16, slug: 'pxd-16', title: 'PXD-16 pixel decoder', sku: 'PXD-16', family: ID.famPixelDecode, order: 2,
    summary: p('Sixteen outputs, dual power domains, RJ45 Ethernet for installs that can’t rely on Wi-Fi.'),
    description: p('For permanent installs. Two power domains let you run half the board off a separate supply, and the Ethernet port keeps show data off the Wi-Fi.'),
    specsData: specsData('Specifications', [['MCU', 'ESP32-S3, 16 MB flash'], ['Outputs', '16 × 5 V level-shifted'], ['Max pixels', '8,192'], ['Network', 'Wi-Fi + 100 Mb Ethernet'], ['Input power', '2 × 5–24 V DC domains']]),
    optionName: 'Outputs', variants: [variant('v-pxd16-16', '16 ch · Ethernet', 'PXD-16', 149, 'Outputs')],
    firmware: [ID.fwPxd], software: [ID.swDesktop], related: [ID.pxd8] }),
  product({ id: ID.pxdMini, slug: 'pxd-mini', title: 'PXD-Mini', sku: 'PXD-MINI', family: ID.famPixelDecode, order: 3,
    summary: p('Two outputs, USB-C powered. For a single lamp, sign or desk piece.'),
    description: p('Small enough to hide in a lamp base. Same firmware, same PixelPilot discovery.'),
    specsData: specsData('Specifications', [['MCU', 'ESP32-S3'], ['Outputs', '2 × 5 V level-shifted'], ['Max pixels', '1,024'], ['Input power', 'USB-C 5 V'], ['Dimensions', '40 × 30 mm']]),
    optionName: 'Outputs', variants: [variant('v-pxdmini-2', '2 ch · Mini', 'PXD-MINI', 39, 'Outputs')],
    firmware: [ID.fwPxd], related: [ID.pxd8] }),
  product({ id: ID.ppHat, slug: 'pixelpilot-hat', title: 'PixelPilot HAT + image', sku: 'PP-HAT', family: ID.famPixelPilot, order: 1,
    summary: p('Raspberry Pi HAT with RTC, status OLED and a pre-built SD card running PixelPilot OS.'),
    description: p('Plug the HAT on, boot the card, open pixelpilot.local. Boards on the network show up on their own.'),
    specsData: specsData('Specifications', [['Fits', 'Raspberry Pi 4 / 5'], ['Extras', 'RTC, 0.96" OLED, 2 × user buttons, fan header'], ['Software', 'PixelPilot OS on 32 GB SD']]),
    optionName: 'Fits', variants: [variant('v-pphat-pi4', 'Pi 4', 'PP-HAT-4', 69, 'Fits'), variant('v-pphat-pi5', 'Pi 5', 'PP-HAT-5', 69, 'Fits')],
    firmware: [ID.fwPilot], software: [ID.swDesktop] }),
  product({ id: ID.bundle, slug: 'starter-bundle', title: 'Starter bundle', sku: 'BUNDLE-START', family: ID.famPixelDecode, order: 4, badges: { bestSeller: false, bundle: true },
    summary: p('PXD-8 + 5 V 10 A supply + 3 m of pre-wired pixel tails. Everything for a first 16 × 16 wall.'),
    description: p('One box, one order. The PXD-8, a 5 V 10 A supply with a mains lead, and three metres of pre-wired three-pin pixel tails.'),
    specsData: specsData('In the box', [['Board', 'PXD-8'], ['Supply', '5 V 10 A, IEC lead'], ['Tails', '3 × 1 m, JST-SM 3-pin']]),
    optionName: 'Title', variants: [variant('v-bundle', 'Default Title', 'BUNDLE-START', 129, 'Title')],
    firmware: [ID.fwPxd], software: [ID.swDesktop], related: [ID.pxd8] }),
];

const firmware = [
  { id: ID.fwPxd, slug: 'pxd-fw-1-4-2', name: 'pxd-fw', version: '1.4.2', date: '2026-08-01', targets: [ID.pxd8, ID.pxd16, ID.pxdMini],
    downloadUrl: 'https://github.com/Elusid108/pxd-fw/releases/latest', file: null, sha256: '0000000000000000000000000000000000000000000000000000000000000000',
    webInstallerManifest: 'https://chrismooredesigns.com/flash/pxd-fw/manifest.json', repo: 'https://github.com/Elusid108/pxd-fw', ota: true,
    notes: '<ul><li>Art-Net sync packet support</li><li>Per-output color order override</li><li>Fix: DDP frames larger than 1,440 bytes were dropped on PXD-Mini</li></ul>', timestamp: now },
  { id: ID.fwPilot, slug: 'pixelpilot-os-0-9-1', name: 'PixelPilot OS', version: '0.9.1', date: '2026-07-12', targets: [ID.ppHat],
    downloadUrl: 'https://github.com/Elusid108/pixelpilot/releases/latest', file: null, sha256: null, webInstallerManifest: null, repo: 'https://github.com/Elusid108/pixelpilot', ota: true,
    notes: '<ul><li>Fleet OTA for pxd-fw 1.4.x</li><li>Show scheduler: sunset/sunrise triggers</li></ul>', timestamp: now },
];

const software = [
  { id: ID.swDesktop, slug: 'pixelpilot-desktop', name: 'PixelPilot Desktop', order: 1, platforms: ['windows', 'macos', 'linux'], version: '0.9.0',
    summary: 'Companion PC app for mapping, previewing and uploading shows to PixelPilot and PixelDecode devices.',
    description: p('Pixel mapping from a photo, live preview over the network, and a one-click firmware flasher.'),
    repo: 'https://github.com/Elusid108/pixelpilot-desktop', releaseUrl: 'https://github.com/Elusid108/pixelpilot-desktop/releases/latest', appUrl: null, screenshots: [], wip: false, timestamp: now },
  { id: ID.swLithoLab, slug: 'litholab', name: 'LithoLab', order: 2, platforms: ['web'], version: null, summary: 'Browser tool that turns a photo into a printable color lithophane.', description: '',
    repo: 'https://github.com/Elusid108/LithoLab', releaseUrl: null, appUrl: 'https://elusid108.github.io/LithoLab/', screenshots: [], wip: false, timestamp: now },
  { id: ID.swPallet, slug: 'lithopalletgen', name: 'LithoPalletGen', order: 3, platforms: ['web'], version: null, summary: 'Generates filament palettes and swap heights for multi-color lithophanes.', description: '',
    repo: 'https://github.com/Elusid108/LithoPalletGen', releaseUrl: null, appUrl: 'https://elusid108.github.io/LithoPalletGen/', screenshots: [], wip: false, timestamp: now },
  { id: ID.swBorder, slug: 'borderbuilder', name: 'BorderBuilder', order: 4, platforms: ['web'], version: null, summary: 'Frames and borders for lithophane prints.', description: '',
    repo: 'https://github.com/Elusid108/BorderBuilder', releaseUrl: null, appUrl: 'https://elusid108.github.io/BorderBuilder/', screenshots: [], wip: true, timestamp: now },
];

const services = [
  { id: ID.svLitho, slug: 'color-lithophanes', name: 'Custom color lithophanes', order: 1, startingPrice: 45, quoteUrl: null, image: null,
    summary: 'Send a photo, get a backlit full-color lithophane printed on a Bambu X1C, optionally with a PixelDecode-driven lamp base.',
    description: p('Sizes from 100 mm to 300 mm. Lamp bases available with a PXD-Mini inside. Supply a photo at least 2,000 px on the long edge; expect 5–7 business days.'),
    relatedApps: [ID.swLithoLab, ID.swPallet, ID.swBorder], timestamp: now },
  { id: ID.svPcba, slug: 'custom-pcba', name: 'Custom PCBA design', order: 2, startingPrice: null, quoteUrl: null, image: null,
    summary: 'Schematic, layout and small-run assembly for pixel and lighting control boards.', description: '', relatedApps: [], timestamp: now },
  { id: ID.svInstall, slug: 'commissioning', name: 'Install & commissioning', order: 3, startingPrice: null, quoteUrl: null, image: null,
    summary: 'On-site pixel mapping, network design and show programming for permanent installs.', description: '', relatedApps: [], timestamp: now },
];

const settings = {
  site: { name: 'Chris Moore Designs', tagline: 'Pixel hardware, firmware, software and custom fabrication for pro-sumer DIYers.', url: 'https://chrismooredesigns.com', currency: 'USD',
    portfolioUrl: 'https://chrismoore.me', github: 'https://github.com/Elusid108', quoteUrl: 'https://chrismoore.me/#contact' },
  shopify: { domain: '', storefrontToken: '', apiVersion: '2026-07' },
  home: {
    heroProduct: ID.pxd8,
    heroVariantsFrom: [ID.pxdMini, ID.pxd8, ID.pxd16],
    shelf: [ID.pxd8, ID.pxd16, ID.pxdMini, ID.ppHat, ID.bundle],
    shelfFilters: [{ label: 'All', key: 'all' }, { label: 'PixelDecode', key: ID.famPixelDecode }, { label: 'PixelPilot', key: ID.famPixelPilot }, { label: 'Bundles', key: 'bundles' }],
    supportStrip: [
      { icon: 'bolt', color: 'accent', title: 'pxd-fw', ref: { firmware: ID.fwPxd }, text: 'Open firmware. OTA from PixelPilot or flash from the browser.', linkLabel: 'Release notes', href: '/firmware/' },
      { icon: 'app', color: 'secondary', title: 'PixelPilot Desktop', ref: { software: ID.swDesktop }, text: 'Map pixels from a photo, preview live, flash boards. Win / macOS / Linux.', linkLabel: 'Download free', href: '/software/' },
      { icon: 'docs', color: 'hardware', title: 'Docs & wiring guides', ref: null, text: 'Power budgeting, injection, Art-Net universes, first-boot captive portal.', linkLabel: 'Read the docs', href: '/firmware/' },
    ],
    trustBullets: ['Ships in 1–2 days from the US', '2-year warranty', 'Open firmware, OTA updates', 'Secure checkout on Shopify'],
    shelfTitle: 'Boards, controllers, bundles',
    servicesTitle: 'Services',
  },
  footer: {
    trustRows: [
      { icon: 'lock', title: 'Secure checkout', text: 'Payment handled by Shopify. This site never sees your card.' },
      { icon: 'box', title: 'Ships from the US', text: 'Tracked. Most orders leave within 2 business days.' },
      { icon: 'wrench', title: '2-year warranty', text: 'Open hardware, repairable, schematic published.' },
    ],
    links: [{ label: 'Portfolio ↗', href: 'https://chrismoore.me' }, { label: 'GitHub ↗', href: 'https://github.com/Elusid108' }, { label: 'Firmware', href: '/firmware/' }, { label: 'Services', href: '/services/' }],
  },
};

mkdirSync('content', { recursive: true });
const write = (name, data) => writeFileSync(`content/${name}.json`, JSON.stringify(data, null, 2) + '\n');
write('settings', settings); write('families', families); write('products', products); write('firmware', firmware); write('software', software); write('services', services);
console.log('seeded content/*.json');
