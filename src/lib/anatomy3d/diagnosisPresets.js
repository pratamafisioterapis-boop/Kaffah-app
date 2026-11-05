// Preset diagnosa untuk menu Anatomi 3D.
//
// Setiap preset menandai struktur anatomi ASLI di model (bukan model penyakit terpisah):
// struktur yang terlibat diwarnai merah dan kamera diarahkan ke sana, struktur lain
// dibuat transparan, lalu terapis menjelaskan dengan teks `explain`.
//
// `targets` = pola nama mesh (regex, huruf kecil) yang cocok untuk penamaan Inggris
// (BodyParts3D/Z-Anatomy) maupun Latin. `layers` = lapisan yang dinyalakan.
// `aliases` dipakai untuk mencocokkan nama diagnosa di daftar diagnosa klinik.

const P = (id, name, aliases, layers, targets, explain) => ({ id, name, aliases, layers, targets, explain });

const MSK = ['skeleton', 'joints', 'muscles'];
const NEURO = ['skeleton', 'nerves', 'muscles'];

export const DIAGNOSIS_PRESETS = [
  // ── Bahu ────────────────────────────────────────────────────────────────
  P('frozen-shoulder', 'Frozen shoulder (Adhesive capsulitis)', ['frozen shoulder', 'adhesive capsulitis', 'kapsulitis'], MSK,
    ['glenohumeral', 'capsul.*(shoulder|humer)', 'coracohumeral', 'glenoid labrum', 'head of humerus|caput humeri', '^humerus$', '^scapula$', 'subscapularis'],
    'Kapsul sendi bahu (glenohumeral) meradang lalu menebal dan mengerut, sehingga ruang gerak bahu menyempit. Gerakan rotasi luar dan mengangkat lengan paling terbatas.'),
  P('rotator-cuff', 'Rotator cuff syndrome / tear', ['rotator cuff'], MSK,
    ['supraspinatus', 'infraspinatus', 'teres minor', 'subscapularis'],
    'Empat otot rotator cuff (supraspinatus, infraspinatus, teres minor, subscapularis) menstabilkan kepala tulang lengan di mangkuk sendi. Tendon yang meradang atau robek menimbulkan nyeri saat mengangkat dan memutar lengan.'),
  P('supraspinatus-tendinitis', 'Tendinitis supraspinatus', ['tendinitis supraspinatus', 'supraspinatus', 'calcific tendinitis'], MSK,
    ['supraspinatus', 'acromion', 'coracoacromial'],
    'Tendon supraspinatus melewati celah sempit di bawah acromion. Peradangan atau pengapuran tendon di sini menyebabkan nyeri di sisi luar bahu, terutama saat lengan diangkat 60–120°.'),
  P('shoulder-impingement', 'Shoulder impingement / Subacromial bursitis', ['impingement', 'subacromial', 'shoulder pain'], MSK,
    ['supraspinatus', 'acromion', 'coracoacromial', 'subacromial', 'subdeltoid', 'long head of biceps|caput longum.*bicipitis'],
    'Jaringan di bawah acromion (tendon supraspinatus dan bursa subakromial) terjepit saat lengan diangkat, sehingga timbul nyeri dan peradangan berulang.'),
  P('shoulder-dislocation', 'Dislokasi / instabilitas bahu', ['shoulder dislocation', 'shoulder instability', 'shoulder subluxation', 'posterior shoulder'], MSK,
    ['glenohumeral', 'glenoid', 'labrum', 'head of humerus|caput humeri', '^scapula$'],
    'Kepala tulang lengan (humerus) keluar dari mangkuk sendi (glenoid). Labrum dan kapsul sendi bisa ikut robek sehingga bahu mudah bergeser lagi.'),
  P('slap-tear', 'SLAP tear', ['slap'], MSK, ['glenoid labrum|labrum', 'long head of biceps|caput longum.*bicipitis', 'glenoid'],
    'Robekan labrum bagian atas (superior) di tempat menempelnya tendon biceps kepala panjang. Keluhan: nyeri dalam di bahu dan sensasi "klik".'),
  P('bicipital-tendinitis', 'Bicipital tendinitis / instability', ['bicipital', 'biceps strain'], MSK,
    ['biceps brachii|biceps', 'intertubercular|bicipital groove', 'transverse humeral'],
    'Tendon biceps kepala panjang di alur depan tulang lengan atas meradang atau bergeser, menimbulkan nyeri di bahu depan.'),
  P('ac-sprain', 'Acromioclavicular sprain', ['acromioclavicular', 'ac joint'], MSK, ['acromioclavicular', 'coracoclavicular', 'clavicle|clavicula', 'acromion'],
    'Cedera ligamen yang mengikat ujung tulang selangka (klavikula) dengan acromion. Biasanya terjadi akibat jatuh dengan bahu menumpu.'),
  P('scapular-dyskinesis', 'Scapular dyskinesis / winging', ['scapular dyskinesis', 'scapular winging', 'long thoracic', 'snapping scapula', 'serratus'], MSK,
    ['serratus anterior', 'trapezius', 'rhomboid', '^scapula$', 'long thoracic nerve|nervus thoracicus longus'],
    'Gerak tulang belikat (skapula) tidak terkoordinasi karena otot serratus anterior, trapezius, dan rhomboid lemah. Pada winging scapula, saraf thoracicus longus sering terlibat.'),

  // ── Siku, pergelangan, tangan ───────────────────────────────────────────
  P('tennis-elbow', 'Tennis elbow (Lateral epicondylitis)', ['tennis elbow', 'lateral epicondyl'], MSK,
    ['extensor carpi radialis brevis', 'extensor carpi radialis', 'extensor digitorum', 'lateral epicondyle|epicondylus lateralis'],
    'Tendon otot ekstensor pergelangan (terutama extensor carpi radialis brevis) mengalami degenerasi di tempat menempelnya pada tonjolan luar siku.'),
  P('golfers-elbow', "Golfer's elbow (Medial epicondylitis)", ['golfer', 'medial epicondyl'], MSK,
    ['flexor carpi radialis', 'pronator teres', 'flexor carpi ulnaris', 'palmaris longus', 'medial epicondyle|epicondylus medialis'],
    'Tendon otot fleksor dan pronator lengan bawah mengalami iritasi di tonjolan dalam siku.'),
  P('cubital-tunnel', 'Cubital tunnel syndrome / Ulnar nerve lesion', ['cubital tunnel', 'ulnar nerve'], NEURO,
    ['ulnar nerve|nervus ulnaris', 'medial epicondyle|epicondylus medialis', 'flexor carpi ulnaris'],
    'Saraf ulnaris tertekan di belakang tonjolan dalam siku. Muncul kesemutan di jari manis dan kelingking serta kelemahan otot kecil tangan.'),
  P('carpal-tunnel', 'Carpal tunnel syndrome', ['carpal tunnel', 'cts'], NEURO,
    ['median nerve|nervus medianus', 'flexor retinaculum(?! of ankle)|retinaculum flexorum|transverse carpal', 'flexor digitorum superficialis', 'flexor pollicis longus'],
    'Saraf medianus tertekan di dalam terowongan karpal (di bawah ligamen transversum karpal). Gejalanya kesemutan atau baal di ibu jari sampai jari manis, terutama malam hari.'),
  P('de-quervain', 'De Quervain disease', ['de quervain', 'thumb tendonitis'], MSK,
    ['abductor pollicis longus', 'extensor pollicis brevis', '^radius$', 'styloid'],
    'Selubung tendon abductor pollicis longus dan extensor pollicis brevis di sisi ibu jari pergelangan menebal, sehingga nyeri saat menggerakkan ibu jari.'),
  P('trigger-finger', 'Trigger finger', ['trigger finger'], MSK, ['flexor digitorum superficialis', 'flexor digitorum profundus', 'flexor pollicis longus', 'phalan'],
    'Tendon fleksor jari menebal sehingga tersangkut di cincin selubung (pulley A1). Jari terkunci saat ditekuk.'),
  P('tfcc', 'TFCC injury / Wrist pain', ['tfcc', 'wrist pain', 'wrist sprain', 'wrist strain', 'dorsal wrist'], MSK,
    ['triangular|articular disc.*wrist|discus articularis', '^ulna$', '^radius$', 'carpal|lunate|triquetr|scaphoid'],
    'Kompleks fibrokartilago triangular (TFCC) di sisi kelingking pergelangan berfungsi sebagai bantalan dan penstabil; cedera menimbulkan nyeri saat memutar pergelangan.'),
  P('radial-nerve', 'Radial nerve lesion / Radial tunnel', ['radial nerve', 'radial tunnel'], NEURO,
    ['radial nerve|nervus radialis', 'supinator', 'humerus', 'extensor'],
    'Saraf radialis yang melingkari tulang lengan atas atau melewati otot supinator tertekan, sehingga otot pengangkat pergelangan melemah (wrist drop).'),

  // ── Leher & kepala ──────────────────────────────────────────────────────
  P('cervicalgia', 'Cervicalgia / Nyeri leher', ['cervicalgia', 'neck pain', 'whiplash', 'postural strain'], MSK,
    ['cervical vertebra|vertebra cervicalis|vertebra c[1-7]\\b|\\batlas\\b|\\baxis\\b', 'trapezius', 'levator scapulae', 'splenius', 'semispinalis'],
    'Nyeri leher dari otot (trapezius, levator scapulae, splenius) dan sendi-sendi tulang leher, sering terkait postur atau cedera hentakan.'),
  P('cervical-radiculopathy', 'Cervical radiculopathy / HNP cervical', ['cervical radiculopathy', 'cervical disc', 'degenerative disc disease cervical', 'cervical spondylosis', 'spinal stenosis cervical'], NEURO.concat('joints'),
    ['cervical vertebra|vertebra cervicalis|vertebra c[1-7]\\b', 'intervertebral dis[ck].*\\bc[1-7]|discus intervertebralis.*\\bc[1-7]', 'brachial plexus|plexus brachialis', '(spinal nerve|nerve root|root).*\\bc[5-8]\\b|\\bc[5-8]\\b.*(spinal nerve|nerve root|root)'],
    'Bantalan tulang leher menonjol atau tulang leher mengalami pengapuran, menekan akar saraf yang keluar ke lengan. Akibatnya nyeri, kesemutan, atau lemah menjalar ke tangan.'),
  P('cervicogenic-headache', 'Cervicogenic / Tension-type headache', ['headache', 'suboccipital', 'upper cervical'], MSK,
    ['suboccipital|rectus capitis|obliquus capitis', 'trapezius', '\\batlas\\b|\\baxis\\b', 'occipital'],
    'Otot suboksipital dan sendi leher atas mengirim nyeri ke kepala bagian belakang dan dahi.'),
  P('upper-cross', 'Upper cross syndrome / Kyphosis postural', ['upper cross', 'kyphosis', 'forward head', 'postural abnormality', 'functional kyphosis'], MSK,
    ['pectoralis', 'trapezius', 'levator scapulae', 'rhomboid', 'serratus anterior', 'sternocleidomastoid', 'longus colli'],
    'Pola ketidakseimbangan: otot dada dan trapezius atas memendek, sedangkan otot leher depan dalam dan otot punggung atas (rhomboid, trapezius bawah) melemah. Akibatnya kepala maju dan punggung membungkuk.'),
  P('torticollis', 'Torticollis', ['torticollis', 'strain sternocleidomastoid'], MSK, ['sternocleidomastoid', 'trapezius', 'scalen'],
    'Otot sternocleidomastoideus memendek atau spasme, sehingga kepala miring ke satu sisi dan berputar ke sisi lain.'),
  P('thoracic-outlet', 'Thoracic outlet syndrome / Scalenus syndrome', ['thoracic outlet', 'scalenus', 'first rib'], NEURO.concat('arteries', 'veins'),
    ['scalen', 'first rib|1st rib|costa prima', 'brachial plexus|plexus brachialis', 'subclavian', 'pectoralis minor'],
    'Saraf pleksus brakialis dan pembuluh subklavia terjepit di antara otot scalenus, tulang rusuk pertama, dan klavikula.'),
  P('tmj', 'Temporomandibular joint disorder', ['temporomandibular', 'tmj', 'tmd'], MSK,
    ['temporomandibular', 'mandible|mandibula', 'masseter', 'temporalis', 'pterygoid'],
    'Gangguan pada sendi rahang dan otot pengunyah (masseter, temporalis, pterygoid), dengan keluhan nyeri, bunyi klik, atau mulut sulit dibuka.'),
  P('bells-palsy', "Bell's palsy / Hemifacial spasm", ["bell", 'facial', 'hemifacial'], ['skeleton', 'nerves', 'muscles'],
    ['facial nerve|nervus facialis', 'orbicularis', 'zygomatic', 'buccinator', 'frontalis|occipitofrontalis'],
    'Saraf fasialis (saraf kranial VII) meradang sehingga otot wajah satu sisi melemah atau berkedut.'),
  P('trigeminal', 'Trigeminal neuralgia', ['trigeminal'], ['skeleton', 'nerves'], ['trigeminal|nervus trigeminus', 'mandibular nerve', 'maxillary nerve', 'ophthalmic nerve'],
    'Saraf trigeminus (saraf kranial V) teriritasi, menimbulkan nyeri tajam seperti tersetrum di wajah.'),

  // ── Punggung & panggul ──────────────────────────────────────────────────
  P('lbp', 'Low back pain / Lumbosacral strain', ['low back pain', 'lumbosacral strain', 'stiffness lumbal', 'vertebrogenic', 'mechanical'], MSK,
    ['lumbar vertebra|vertebra lumbalis|vertebra l[1-5]\\b', 'erector spinae|longissimus|iliocostalis|multifidus', 'quadratus lumborum', 'sacrum'],
    'Nyeri punggung bawah dari otot penyangga tulang belakang (erector spinae, multifidus, quadratus lumborum), sendi, dan jaringan di sekitar tulang lumbal.'),
  P('hnp-lumbar', 'HNP / Lumbar disc bulging', ['hernia nucleus pulposus', 'hnp', 'disc bulging', 'degenerative disc disease lumbar', 'nerve root compression', 'post op lumbar'], NEURO.concat('joints'),
    ['lumbar vertebra|vertebra lumbalis|vertebra l[1-5]\\b', 'intervertebral dis[ck].*(\\bl[1-5]|\\bs1)|discus intervertebralis.*(\\bl[1-5]|\\bs1)', 'nucleus pulposus', 'annulus', 'sciatic nerve|nervus ischiadicus', '(spinal nerve|nerve root|root).*(\\bl[3-5]|\\bs1)\\b|(\\bl[3-5]|\\bs1)\\b.*(spinal nerve|nerve root|root)'],
    'Inti bantalan tulang belakang (nucleus pulposus) menonjol keluar lewat robekan annulus, lalu menekan akar saraf. Nyeri bisa menjalar ke bokong dan tungkai (ischialgia).'),
  P('sciatica', 'Ischialgia / Sciatic neuropathy', ['ischialgia', 'sciatic', 'sciatica', 'deep gluteal'], NEURO,
    ['sciatic nerve|nervus ischiadicus', 'piriformis', 'gluteus', 'tibial nerve|common fibular|common peroneal'],
    'Saraf skiatik, saraf terbesar di tubuh, teriritasi di sepanjang jalurnya dari punggung bawah, bokong, sampai tungkai.'),
  P('piriformis', 'Piriformis syndrome', ['piriformis'], NEURO, ['piriformis', 'sciatic nerve|nervus ischiadicus', 'gluteus maximus', 'gemell|obturator internus'],
    'Otot piriformis yang tegang atau spasme menekan saraf skiatik di bokong.'),
  P('spondylolisthesis', 'Spondylolisthesis / Spondylolysis', ['spondylolisthesis', 'spondylolysis'], MSK.concat('nerves'),
    ['vertebra l5|fifth lumbar|lumbar vertebra|vertebra lumbalis', 'sacrum', 'intervertebral dis[ck].*(\\bl[4-5]|\\bs1)', 'pars|lamina'],
    'Ruas tulang lumbal bergeser ke depan terhadap ruas di bawahnya (paling sering L5 terhadap S1), biasanya karena retak pada pars interarticularis.'),
  P('lumbar-stenosis', 'Spinal stenosis lumbal / Spondylosis', ['spinal stenosis lumbar', 'lumbar spondylosis', 'spondyloarthrosis', 'facet joint'], MSK.concat('nerves'),
    ['lumbar vertebra|vertebra lumbalis|vertebra l[1-5]\\b', 'zygapophys|facet', 'ligamentum flavum|flaval', 'cauda equina|spinal cord'],
    'Saluran saraf di tulang lumbal menyempit akibat pengapuran sendi facet, penebalan ligamentum flavum, dan penonjolan diskus, sehingga tungkai cepat lelah atau baal saat berjalan.'),
  P('scoliosis', 'Scoliosis', ['scoliosis', 'lateral pelvic tilt'], MSK, ['vertebra', '\\bribs?\\b|\\bcostae?\\b', 'erector spinae', 'quadratus lumborum', 'pelvis|hip bone'],
    'Tulang belakang melengkung ke samping dan berputar, sehingga bahu, tulang belikat, atau panggul tampak tidak simetris.'),
  P('si-joint', 'Sacroiliac joint dysfunction', ['sacroiliac', 'si joint', 'pelvic girdle', 'tailbone', 'coxytis', 'coccy'], MSK,
    ['sacroiliac', 'sacrum', '\\bilium\\b|hip bone', 'coccyx|coccyg'],
    'Sendi sakroiliaka yang menghubungkan tulang sakrum dengan panggul bergerak terlalu kaku atau terlalu longgar, sehingga nyeri terasa di bokong atau pinggang bawah.'),
  P('lower-cross', 'Lower cross syndrome / Anterior pelvic tilt', ['lower cross', 'anterior pelvic tilt', 'lordosis', 'posterior pelvic tilt'], MSK,
    ['iliopsoas|psoas|iliacus', 'rectus femoris', 'erector spinae', 'gluteus maximus', 'rectus abdominis', 'pelvis|hip bone'],
    'Otot fleksor panggul dan punggung bawah memendek, sementara otot perut dan bokong melemah. Akibatnya panggul miring ke depan dan lengkung pinggang bertambah.'),
  P('diastasis-recti', 'Diastasis recti', ['diastasis recti', 'postpartum'], ['skeleton', 'muscles'], ['rectus abdominis', 'linea alba', 'transversus abdominis', 'obliquus|oblique'],
    'Kedua otot rectus abdominis merenggang dari garis tengah (linea alba), umumnya setelah kehamilan.'),

  // ── Panggul & paha ──────────────────────────────────────────────────────
  P('hip-oa', 'Osteoarthritis hip / Post THR', ['osteoarthritis of hip', 'joint replacement (hip)', 'hip pain', 'fracture of neck of femur', 'post op fracture femur'], MSK,
    ['head of femur|caput femoris|femur', 'acetabul', 'hip joint|articulatio coxae', 'iliofemoral', 'gluteus medius'],
    'Tulang rawan sendi panggul (antara kepala femur dan acetabulum) menipis, sehingga timbul nyeri selangkangan dan kekakuan.'),
  P('hip-impingement', 'Hip impingement / Labral tear', ['hip impingement', 'labral tear of hip', 'ischiofemoral'], MSK,
    ['acetabul', 'labrum', '\\bfemur\\b|neck of femur', 'iliopsoas'],
    'Bentuk tulang femur atau acetabulum yang tidak pas membuat labrum panggul terjepit dan robek saat panggul ditekuk dalam.'),
  P('gtps', 'Greater trochanteric pain / Gluteal tendinopathy', ['greater trochanteric', 'gluteal tendinopathy', 'snapping hip'], MSK,
    ['gluteus medius', 'gluteus minimus', 'greater trochanter|trochanter major', 'tensor fasciae latae', 'iliotibial'],
    'Tendon gluteus medius dan minimus di tonjolan samping paha atas (trokanter mayor) mengalami degenerasi. Nyeri timbul saat tidur menyamping.'),
  P('hamstring', 'Hamstring strain / tightness', ['hamstring'], MSK, ['biceps femoris', 'semitendinosus', 'semimembranosus', 'ischial tuberosity|tuber ischiadicum'],
    'Cedera pada kelompok otot paha belakang (biceps femoris, semitendinosus, semimembranosus), paling sering saat sprint.'),
  P('quadriceps', 'Quadriceps strain / tightness', ['quadriceps'], MSK, ['rectus femoris', 'vastus', 'quadriceps'],
    'Cedera atau ketegangan otot paha depan, terutama rectus femoris yang melintasi dua sendi.'),
  P('adductor', 'Adductor / Groin strain', ['adductor', 'groin', 'osteitis pubis', 'pubic symphysis', 'obturator nerve'], MSK,
    ['adductor', 'gracilis', 'pectineus', 'pubic|pubis|symphysis'],
    'Cedera otot adduktor di paha dalam dekat tulang kemaluan, sering terjadi pada olahraga dengan gerakan mengubah arah.'),
  P('iliopsoas', 'Iliopsoas tendinitis', ['iliopsoas'], MSK, ['iliopsoas|psoas|iliacus', 'lesser trochanter|trochanter minor'],
    'Tendon otot iliopsoas, fleksor utama panggul, meradang di bagian depan panggul.'),

  // ── Lutut ───────────────────────────────────────────────────────────────
  P('knee-oa', 'Knee osteoarthritis / Post TKR', ['knee osteoarthritis', 'joint replacement (knee)', 'knee pain', 'polyosteoarthritis', 'genu varum', 'genu valgum'], MSK,
    ['^femur$', '^tibia$', 'patella', 'menisc', 'articular cartilage.*(knee|femur|tibia)|knee joint|articulatio genus'],
    'Tulang rawan sendi lutut menipis, sehingga tulang femur dan tibia saling bergesek. Keluhannya nyeri, kaku, kadang bengkak, dan bunyi krepitasi.'),
  P('acl', 'ACL injury / Post op ACL', ['acl', 'anterior cruciate', 'anterior lateral ligament', 'knee instability'], MSK,
    ['anterior cruciate|cruciatum anterius', '^femur$', '^tibia$', 'menisc'],
    'Ligamen krusiatum anterior (ACL) di dalam lutut mencegah tulang kering bergeser ke depan. Robeknya ACL membuat lutut terasa goyang ("giving way").'),
  P('pcl', 'PCL injury', ['pcl', 'posterior cruciate'], MSK, ['posterior cruciate|cruciatum posterius', '^femur$', '^tibia$'],
    'Ligamen krusiatum posterior (PCL) mencegah tulang kering bergeser ke belakang; biasanya cedera akibat benturan pada lutut depan.'),
  P('mcl-lcl', 'MCL / LCL sprain', ['mcl', 'lcl', 'sprain ligament genu', 'ligament sprain'], MSK,
    ['medial collateral|tibial collateral|collaterale tibiale', 'lateral collateral|fibular collateral|collaterale fibulare', '^femur$', '^tibia$', '^fibula$'],
    'Cedera ligamen kolateral di sisi dalam (MCL) atau sisi luar (LCL) lutut, akibat lutut tertekuk ke samping.'),
  P('meniscus', 'Meniscus lesion / Post op meniscus', ['menisc'], MSK, ['menisc', '^femur$', '^tibia$'],
    'Meniskus adalah bantalan tulang rawan berbentuk C di dalam lutut. Robekannya bisa membuat lutut terkunci, nyeri di garis sendi, dan bengkak.'),
  P('pfps', 'Patellofemoral pain / Chondromalacia', ['patellofemoral', 'pfps', 'chondromalacia', 'patellar instability', 'patella alta', 'medial plica', 'bipartite patella', 'fracture patella'], MSK,
    ['patella', 'vastus medialis', 'vastus lateralis', '^femur$', 'quadriceps|rectus femoris'],
    'Nyeri di sekitar tempurung lutut karena tekanan berlebih di antara patella dan alur femur, sering disertai lemahnya otot vastus medialis.'),
  P('patellar-tendinitis', "Patellar tendinitis / Jumper's knee", ['patellar tendinitis', 'jumper', 'osgood', 'sinding-larsen'], MSK,
    ['patellar ligament|ligamentum patellae|patellar tendon', 'patella', 'tibial tuberosity|tuberositas tibiae'],
    'Tendon patella yang menghubungkan tempurung lutut ke tulang kering mengalami beban berlebih berulang, misalnya karena melompat.'),
  P('itbs', 'Iliotibial band syndrome', ['iliotibial', 'itb'], MSK, ['iliotibial|tractus iliotibialis', 'tensor fasciae latae', 'lateral condyle|condylus lateralis'],
    'Pita iliotibial bergesek dengan tonjolan luar tulang paha di sisi luar lutut, sering dialami pelari.'),
  P('pes-anserine', 'Pes anserinus bursitis / Baker cyst', ['pes anserin', 'baker'], MSK,
    ['sartorius', 'gracilis', 'semitendinosus', 'gastrocnemius', 'semimembranosus', '^tibia$'],
    'Bursa di sisi dalam lutut bawah (tempat sartorius, gracilis, dan semitendinosus menempel), atau kista di lipat lutut belakang (Baker), meradang dan membengkak.'),

  // ── Tungkai bawah, pergelangan kaki, kaki ──────────────────────────────
  P('ankle-sprain', 'Ankle sprain / Post op ATFL', ['ankle sprain', 'ankle instability', 'atfl', 'sprain of foot', 'ankle dislocation', 'stiffness ankle', 'sinus tarsi'], MSK,
    ['anterior talofibular|talofibulare anterius', 'calcaneofibular', 'posterior talofibular', 'deltoid ligament|ligamentum mediale', 'talus', '^fibula$'],
    'Ligamen di sisi luar pergelangan kaki (terutama ATFL) teregang atau robek akibat kaki terkilir ke dalam.'),
  P('achilles', 'Achilles tendinitis / rupture', ['achilles', 'calf muscle tightness', 'strain gastroc', 'sever', 'calcaneal apophysitis'], MSK,
    ['calcaneal tendon|achilles|tendo calcaneus', 'gastrocnemius', 'soleus', 'calcaneus'],
    'Tendon Achilles menghubungkan otot betis (gastrocnemius dan soleus) ke tulang tumit. Bisa mengalami degenerasi, peradangan, sampai robek.'),
  P('plantar-fasciitis', 'Plantar fasciitis / Calcaneus spur', ['plantar fasciitis', 'calcaneus spur', 'pain in foot', 'flat foot', 'pes cavus'], MSK,
    ['plantar aponeurosis|aponeurosis plantaris|plantar fascia', 'calcaneus', 'flexor digitorum brevis', 'abductor hallucis'],
    'Jaringan fascia di telapak kaki meradang di perlekatannya pada tulang tumit. Nyeri paling terasa saat langkah pertama di pagi hari.'),
  P('shin-splint', 'Shin splint / Tibialis tendinitis', ['shin splint', 'anterior tibialis', 'posterior tibial', 'tendinitis, foot'], MSK,
    ['tibialis anterior', 'tibialis posterior', '^tibia$', 'soleus', 'flexor digitorum longus'],
    'Nyeri di sepanjang tulang kering akibat tarikan otot tibialis dan soleus pada lapisan pembungkus tulang (periosteum) karena beban berulang.'),
  P('peroneal', 'Peroneal tendinitis / Foot drop', ['peroneal', 'foot drop', 'fibular'], NEURO,
    ['fibularis|peroneus', 'common fibular|common peroneal|nervus fibularis|deep fibular|superficial fibular', '^fibula$', 'tibialis anterior'],
    'Tendon peroneus di belakang mata kaki luar meradang. Pada foot drop, saraf peroneus di bawah lutut tertekan sehingga punggung kaki tidak bisa diangkat.'),
  P('hallux-valgus', 'Hallux valgus / Bunion / Turf toe', ['hallux valgus', 'bunion', 'turf toe', 'sesamoid', 'metatarsalgia', 'morton', 'plantar plate'], MSK,
    ['first metatarsal|metatarsal', 'proximal phalanx|phalan', 'adductor hallucis', 'abductor hallucis', 'sesamoid', 'plantar digital nerve'],
    'Ibu jari kaki menyimpang ke arah jari lain dan pangkalnya menonjol. Keluhan di depan kaki juga bisa berasal dari sendi metatarsal, tulang sesamoid, atau saraf interdigital (Morton).'),

  // ── Neurologi ───────────────────────────────────────────────────────────
  P('stroke', 'Stroke dengan hemiparesis', ['stroke', 'hemiplegia', 'hemiparesis', 'craniotomy', 'spasticity'], ['skeleton', 'nerves', 'organs', 'arteries'],
    ['brain|cerebr|encephalon', 'internal carotid|carotis interna', 'middle cerebral|cerebri media', 'vertebral artery|arteria vertebralis', 'spinal cord|medulla spinalis'],
    'Aliran darah ke bagian otak terganggu (sumbatan atau perdarahan), sehingga jalur saraf motorik ke satu sisi tubuh terganggu dan menyebabkan lemah pada sisi tersebut.'),
  P('parkinson', "Parkinson's disease", ['parkinson'], ['skeleton', 'nerves', 'organs'], ['brain|cerebr|encephalon', 'basal|substantia nigra|midbrain|mesencephalon', 'brainstem|brain stem|truncus'],
    'Sel penghasil dopamin di batang otak (substantia nigra) berkurang, sehingga gerakan menjadi lambat, kaku, dan tremor.'),
  P('spinal-cord', 'Paraplegia / Quadriplegia / Spinal cord', ['paraplegia', 'quadriplegia', 'paraparesis', 'multiple sclerosis'], ['skeleton', 'nerves'],
    ['spinal cord|medulla spinalis', 'cauda equina', 'vertebra', 'spinal nerve'],
    'Sumsum tulang belakang menghantarkan perintah dari otak ke seluruh tubuh. Cedera atau penyakit di level tertentu memengaruhi otot di bawah level tersebut.'),
  P('brachial-plexus', 'Brachial plexus injury / Axillary nerve', ['brachial plexus', 'axillary nerve', 'suprascapular nerve'], NEURO,
    ['brachial plexus|plexus brachialis', 'axillary nerve|nervus axillaris', 'suprascapular nerve|nervus suprascapularis', 'deltoid', 'supraspinatus|infraspinatus'],
    'Jaringan saraf dari leher ke lengan (pleksus brakialis) cedera karena tarikan atau tekanan, sehingga otot bahu atau lengan melemah.'),
  P('peripheral-neuropathy', 'Peripheral / Diabetic neuropathy', ['neuropathy', 'polyneuropathy'], ['skeleton', 'nerves'],
    ['tibial nerve|nervus tibialis', 'fibular nerve|peroneal nerve', 'sural', 'plantar nerve', 'median nerve|ulnar nerve'],
    'Saraf tepi, terutama di ujung kaki dan tangan, rusak, misalnya akibat diabetes, sehingga muncul baal, kesemutan, atau rasa terbakar.'),
  P('vestibular', 'Vertigo / Vestibular dysfunction', ['vertigo', 'vestibular', 'labyrinthitis', 'meniere', 'dizziness'], ['skeleton', 'nerves', 'organs'],
    ['vestibul|labyrinth|semicircular|cochlea', 'temporal bone|os temporale', 'vestibulocochlear'],
    'Organ keseimbangan di telinga dalam (kanal semisirkular dan vestibulum) atau sarafnya terganggu, menimbulkan rasa berputar dan sulit seimbang.'),

  // ── Kardiorespirasi ────────────────────────────────────────────────────
  P('copd', 'COPD / Bronkitis / Pneumonia', ['pulmonary', 'bronch', 'pneumonia', 'respiratory', 'post-covid', 'copd'], ['skeleton', 'organs', 'muscles'],
    ['lung|pulmo', 'trachea', 'bronch', 'diaphragm', 'intercostal', '\\bribs?\\b|\\bcostae?\\b'],
    'Saluran napas dan paru terganggu (menyempit, berlendir, atau meradang). Fisioterapi melatih otot pernapasan (diafragma, interkostal) dan membantu membersihkan jalan napas.'),

  // ── Umum ────────────────────────────────────────────────────────────────
  P('osteoporosis', 'Osteoporosis dengan fraktur', ['osteoporosis', 'lumbar fracture', 'sacral stress', 'pathological fracture', 'frailty', 'risiko jatuh'], ['skeleton'],
    ['vertebra', 'neck of femur|^femur$', '^radius$', 'humerus'],
    'Kepadatan tulang berkurang sehingga tulang rapuh. Lokasi patah tersering adalah tulang belakang, leher femur, dan pergelangan tangan.'),
];

const lc = (s) => String(s || '').toLowerCase();

// Cari preset untuk nama diagnosa klinik (mis. dari rekam medis).
export const findPresetForDiagnosis = (diagnosisName) => {
  const d = lc(diagnosisName);
  if (!d) return null;
  let best = null;
  for (const p of DIAGNOSIS_PRESETS) {
    for (const a of [p.name, ...p.aliases]) {
      const al = lc(a);
      if (d.includes(al) || al.includes(d)) {
        if (!best || al.length > best.len) best = { preset: p, len: al.length };
      }
    }
  }
  return best?.preset || null;
};

export const compileTargets = (preset) => (preset?.targets || []).map((t) => new RegExp(t, 'i'));
