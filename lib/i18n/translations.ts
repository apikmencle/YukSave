export type Lang = "id" | "en";

export const translations = {
  id: {
    header: {
      navCaraPakai: "Cara Pakai",
      langLabel: "Bahasa",
      themeToLight: "Ganti ke mode terang",
      themeToDark: "Ganti ke mode gelap",
      menuAria: "Buka menu navigasi",
      menuTitle: "Menu",
    },
    hero: {
      badge: "Rec · Tanpa Watermark",
      title1: "Simpan video",
      title2: "sebelum hilang.",
      subtitle:
        "Tempel link TikTok, dapat video, foto slideshow, atau audio MP3 tanpa watermark dalam hitungan detik.",
    },
    form: {
      placeholder: "https://vt.tiktok.com/...",
      download: "Download",
      processing: "Memproses",
      errorEmpty: "Tempel dulu link videonya.",
      errorGeneric: "Link tidak bisa diproses. Coba link lain.",
      errorConnection: "Ada gangguan koneksi. Coba lagi sebentar.",
      pasteAria: "Tempel dari clipboard",
      pasteFailed: "Tidak bisa mengakses clipboard. Tempel manual ya.",
      cancel: "Batal",
      slowNotice: "Masih diproses \\u2014 server sumber sedang lambat, mohon tunggu sebentar.",
    },
    history: {
      heading: "Riwayat Unduhan",
      empty: "Belum ada riwayat di perangkat ini.",
      clear: "Hapus Riwayat",
      reuse: "Buka Lagi",
      disclaimer: "Riwayat ini hanya tersimpan di perangkat kamu, bukan di server kami.",
    },
    apiErrors: {
      invalid_url: "Link TikTok tidak valid.",
      rate_limited: "Terlalu banyak permintaan. Coba lagi sebentar.",
      parse_failed:
        "Gagal memproses link ini. Server sumber mungkin sedang bermasalah, coba lagi nanti.",
      verification_failed: "Verifikasi keamanan gagal. Coba lagi.",
    },
    emptyState: {
      hint: "Tempel link TikTok di atas buat mulai",
    },
    features: {
      video: { title: "Video", desc: "Tanpa watermark" },
      photo: { title: "Foto Slideshow", desc: "Semua foto sekaligus" },
      audio: { title: "Audio MP3", desc: "Ambil suaranya saja" },
    },
    result: {
      downloadNoWatermark: "Download (Tanpa Watermark)",
      downloadWithWatermark: "Dengan Watermark",
      downloadAudio: "Download Audio (MP3)",
      slideshowCount: (n: number) => `${n} foto dalam slideshow ini`,
      photoAlt: (i: number) => `Foto ${i}`,
      download: "Download",
      downloadAllPhotos: "Download Semua (ZIP)",
      zippingPhotos: "Menyiapkan ZIP...",
    },
    howTo: {
      heading: "Cara download video TikTok tanpa watermark",
      steps: [
        "Buka aplikasi TikTok, cari video yang mau disimpan",
        "Tap ikon Share, lalu pilih \u201cCopy Link\u201d",
        "Tempel link tersebut ke kotak di atas",
        "Tap \u201cDownload\u201d, lalu unduh hasilnya \u2014 tanpa watermark",
      ],
    },
    faq: {
      heading: "Pertanyaan yang sering ditanyakan",
      items: [
        {
          q: "Apakah YukSave benar-benar gratis?",
          a: "Ya, download video TikTok tanpa watermark di YukSave gratis sepenuhnya, tanpa batas jumlah download dan tanpa perlu login.",
        },
        {
          q: "Apakah perlu install aplikasi?",
          a: "Tidak. YukSave berjalan langsung di browser HP atau komputer, tidak perlu instalasi apapun.",
        },
        {
          q: "Kenapa hasil downloadnya tidak ada watermark?",
          a: "YukSave mengambil versi video langsung dari server TikTok sebelum watermark ditambahkan, sehingga hasilnya bersih.",
        },
        {
          q: "Bisa download foto slideshow atau audio saja?",
          a: "Bisa. Kalau link yang kamu tempel berupa postingan foto slideshow, YukSave akan menampilkan setiap foto untuk diunduh satu per satu. Kalau videonya punya audio yang bisa diambil terpisah, tombol \u201cDownload Audio (MP3)\u201d akan muncul juga.",
        },
      ],
    },
    footer: {
      note: "Untuk penggunaan pribadi \u2014 hormati hak cipta kreator asli.",
      privacy: "Kebijakan Privasi",
      terms: "Syarat & Ketentuan",
    },
    privacy: {
      title: "Kebijakan Privasi",
      lastUpdated: "Terakhir diperbarui",
      // Tanggal statis (bukan new Date()) supaya tidak mismatch antara
      // render server (UTC) dan browser (WIB), dan supaya benar-benar
      // mencerminkan kapan teks ini terakhir diubah. Update manual tiap
      // kali isi kebijakan ini benar-benar direvisi.
      lastUpdatedDate: "23 Juli 2026",
      sections: [
        {
          heading: "Data apa yang kami simpan",
          body: "YukSave mencatat link video yang diminta dan alamat IP dalam bentuk hash (bukan alamat IP asli) untuk keperluan cache dan mencegah penyalahgunaan (rate limiting). Kami tidak menyimpan file video atau foto apapun di server kami \u2014 file diunduh langsung dari sumbernya.",
        },
        {
          heading: "Kami tidak meminta akun",
          body: "YukSave tidak mewajibkan login atau pendaftaran akun apapun untuk digunakan.",
        },
        {
          heading: "Cookie",
          body: "Cookie hanya digunakan untuk fitur dashboard admin internal (bukan untuk melacak pengguna biasa).",
        },
        {
          heading: "Pihak ketiga",
          body: "Untuk memproses link video, YukSave mengirimkan link tersebut ke layanan pengambil data pihak ketiga. Kami tidak mengendalikan kebijakan privasi layanan tersebut.",
        },
        {
          heading: "Perubahan kebijakan",
          body: "Kebijakan ini dapat diperbarui sewaktu-waktu. Perubahan akan langsung berlaku setelah dipublikasikan di halaman ini.",
        },
      ],
    },
    terms: {
      title: "Syarat & Ketentuan",
      lastUpdated: "Terakhir diperbarui",
      lastUpdatedDate: "23 Juli 2026",
      sections: [
        {
          heading: "Penggunaan layanan",
          body: "YukSave adalah alat bantu untuk mengunduh video, foto, atau audio dari konten publik TikTok untuk penggunaan pribadi. Dengan menggunakan layanan ini, kamu setuju untuk tidak menyalahgunakannya untuk tujuan komersial tanpa izin dari pemilik konten asli.",
        },
        {
          heading: "Hak cipta",
          body: "Setiap video, foto, dan audio yang diunduh melalui YukSave tetap menjadi hak milik kreator aslinya. Kami mendorong pengguna untuk selalu memberikan kredit kepada kreator asli saat membagikan ulang konten.",
        },
        {
          heading: "Tidak ada jaminan layanan",
          body: "YukSave bergantung pada layanan pihak ketiga yang bisa berubah atau tidak tersedia sewaktu-waktu tanpa pemberitahuan. Kami tidak menjamin layanan akan selalu berfungsi 100% setiap saat.",
        },
        {
          heading: "Batasan tanggung jawab",
          body: "YukSave tidak bertanggung jawab atas penyalahgunaan konten yang diunduh oleh pengguna, termasuk pelanggaran hak cipta yang dilakukan pengguna terhadap pihak lain.",
        },
        {
          heading: "Perubahan ketentuan",
          body: "Ketentuan ini dapat diperbarui sewaktu-waktu. Perubahan akan langsung berlaku setelah dipublikasikan di halaman ini.",
        },
      ],
    },
  },
  en: {
    header: {
      navCaraPakai: "How It Works",
      langLabel: "Language",
      themeToLight: "Switch to light mode",
      themeToDark: "Switch to dark mode",
      menuAria: "Open navigation menu",
      menuTitle: "Menu",
    },
    hero: {
      badge: "Rec · No Watermark",
      title1: "Save the video",
      title2: "before it's gone.",
      subtitle:
        "Paste a TikTok link and get the video, photo slideshow, or MP3 audio without a watermark in seconds.",
    },
    form: {
      placeholder: "https://vt.tiktok.com/...",
      download: "Download",
      processing: "Processing",
      errorEmpty: "Paste a video link first.",
      errorGeneric: "That link couldn't be processed. Try another one.",
      errorConnection: "Connection trouble. Please try again shortly.",
      pasteAria: "Paste from clipboard",
      pasteFailed: "Couldn't access the clipboard. Please paste it manually.",
      cancel: "Cancel",
      slowNotice: "Still processing \\u2014 the source server is slow right now, hang tight.",
    },
    history: {
      heading: "Download History",
      empty: "No history on this device yet.",
      clear: "Clear History",
      reuse: "Open Again",
      disclaimer: "This history is only stored on your device, not on our servers.",
    },
    apiErrors: {
      invalid_url: "That's not a valid TikTok link.",
      rate_limited: "Too many requests. Please try again shortly.",
      parse_failed:
        "Couldn't process that link. The source server may be having issues — try again later.",
      verification_failed: "Security check failed. Please try again.",
    },
    emptyState: {
      hint: "Paste a TikTok link above to get started",
    },
    features: {
      video: { title: "Video", desc: "No watermark" },
      photo: { title: "Photo Slideshow", desc: "All photos at once" },
      audio: { title: "MP3 Audio", desc: "Just the sound" },
    },
    result: {
      downloadNoWatermark: "Download (No Watermark)",
      downloadWithWatermark: "With Watermark",
      downloadAudio: "Download Audio (MP3)",
      slideshowCount: (n: number) => `${n} photos in this slideshow`,
      photoAlt: (i: number) => `Photo ${i}`,
      download: "Download",
      downloadAllPhotos: "Download All (ZIP)",
      zippingPhotos: "Preparing ZIP...",
    },
    howTo: {
      heading: "How to download TikTok videos without a watermark",
      steps: [
        "Open the TikTok app and find the video you want to save",
        "Tap the Share icon, then choose \u201cCopy Link\u201d",
        "Paste that link into the box above",
        "Tap \u201cDownload\u201d and save the result \u2014 watermark-free",
      ],
    },
    faq: {
      heading: "Frequently asked questions",
      items: [
        {
          q: "Is YukSave really free?",
          a: "Yes, downloading TikTok videos without a watermark on YukSave is completely free, with no download limits and no login required.",
        },
        {
          q: "Do I need to install an app?",
          a: "No. YukSave runs right in your phone or computer's browser \u2014 no installation needed.",
        },
        {
          q: "Why doesn't the download have a watermark?",
          a: "YukSave fetches the version of the video straight from TikTok's servers before the watermark is added, so the result is clean.",
        },
        {
          q: "Can I download just a photo slideshow or audio?",
          a: "Yes. If the link you paste is a photo slideshow post, YukSave will show each photo so you can download them one by one. If the video has audio that can be extracted separately, a \u201cDownload Audio (MP3)\u201d button will show up too.",
        },
      ],
    },
    footer: {
      note: "For personal use \u2014 please respect the original creator's copyright.",
      privacy: "Privacy Policy",
      terms: "Terms & Conditions",
    },
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "Last updated",
      lastUpdatedDate: "July 23, 2026",
      sections: [
        {
          heading: "What data we store",
          body: "YukSave logs the requested video link and a hashed version of the IP address (not the raw IP) for caching and rate limiting purposes. We don't store any video or photo files on our servers \u2014 files are downloaded directly from their source.",
        },
        {
          heading: "We don't require an account",
          body: "YukSave doesn't require you to log in or register any account to use it.",
        },
        {
          heading: "Cookies",
          body: "Cookies are only used for the internal admin dashboard feature (not to track regular users).",
        },
        {
          heading: "Third parties",
          body: "To process video links, YukSave sends the link to a third-party data-retrieval service. We don't control that service's privacy policy.",
        },
        {
          heading: "Policy changes",
          body: "This policy may be updated from time to time. Changes take effect immediately once published on this page.",
        },
      ],
    },
    terms: {
      title: "Terms & Conditions",
      lastUpdated: "Last updated",
      lastUpdatedDate: "July 23, 2026",
      sections: [
        {
          heading: "Use of the service",
          body: "YukSave is a tool for downloading videos, photos, or audio from public TikTok content for personal use. By using this service, you agree not to misuse it for commercial purposes without permission from the original content owner.",
        },
        {
          heading: "Copyright",
          body: "Every video, photo, and audio file downloaded through YukSave remains the property of its original creator. We encourage users to always credit the original creator when resharing content.",
        },
        {
          heading: "No service guarantee",
          body: "YukSave depends on third-party services that may change or become unavailable at any time without notice. We don't guarantee the service will work 100% of the time.",
        },
        {
          heading: "Limitation of liability",
          body: "YukSave is not responsible for misuse of downloaded content by users, including copyright infringement committed by users against other parties.",
        },
        {
          heading: "Changes to these terms",
          body: "These terms may be updated from time to time. Changes take effect immediately once published on this page.",
        },
      ],
    },
  },
} as const;
