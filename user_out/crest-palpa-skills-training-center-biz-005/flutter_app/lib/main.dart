import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';

const String kInstitutePayload = "{\n  \"business\": {\n    \"id\": \"biz-005\",\n    \"slug\": \"test-5\",\n    \"name\": \"Crest Palpa Skills Training Center\",\n    \"type\": \"Training Institute\",\n    \"locationLabel\": \"Palpa, Lumbini\",\n    \"affiliation\": \"Private\"\n  },\n  \"app\": {\n    \"app_name\": \"Crest Palpa Skills Training Center\",\n    \"app_tagline\": \"Training Institute · Palpa, Lumbini\",\n    \"intro_title\": \"Crest Palpa Skills Training Center\",\n    \"intro_body\": \"Crest Palpa Skills Training Center is a fully populated demo listing created for search, filter, media, and payment testing. It includes academic offerings, facilities, social links, contact data, and active payment history so the entire directory flow can be exercised without manual entry.\",\n    \"director_name\": \"\",\n    \"director_role\": \"Academic Lead\",\n    \"director_message\": \"Welcome to Crest Palpa Skills Training Center. Use this section to introduce the institute philosophy, learner promise, and the atmosphere you want parents and students to feel before visiting.\",\n    \"admissions_note\": \"Explain the admission cycle, required documents, scholarship opportunities, interview flow, and any intake deadlines here.\",\n    \"contact_headline\": \"Start The Conversation\",\n    \"theme_seed\": \"#16605a\",\n    \"logo_url\": \"https://dummyimage.com/360x360/fff2bf/5b4210.png?text=CP\",\n    \"hero_image_url\": \"https://dummyimage.com/1600x980/fff2bf/5b4210.jpg?text=Crest%20Palpa%20Skills%20Training%20Center\",\n    \"gallery\": [\n      \"https://dummyimage.com/1400x920/fff2bf/5b4210.jpg?text=Crest%20Palpa%20Skills%20Training%20Center%20Main%20Block\",\n      \"https://dummyimage.com/1400x920/dff4f7/173a46.jpg?text=Crest%20Palpa%20Skills%20Training%20Center%20Learning%20Space\",\n      \"https://dummyimage.com/1400x920/f3f6fb/5b4210.jpg?text=Crest%20Palpa%20Skills%20Training%20Center%20Student%20Life\",\n      \"https://drive.google.com/drive/folders/gallery-test-5-folder\"\n    ],\n    \"videos\": [\n      {\n        \"title\": \"Campus Video\",\n        \"url\": \"https://vimeo.com/22439234\"\n      },\n      {\n        \"title\": \"Campus Video\",\n        \"url\": \"https://www.youtube.com/watch?v=ysz5S6PUM-U\"\n      }\n    ],\n    \"programs\": [\n      \"Full Stack Bootcamp\",\n      \"English Communication\",\n      \"Graphic Design\",\n      \"Digital Marketing\",\n      \"Career Coaching\"\n    ],\n    \"facilities\": [\n      \"Mac Lab\",\n      \"Studio Room\",\n      \"Wi-Fi Campus\",\n      \"Career Desk\",\n      \"Cafe\",\n      \"Student Counseling\",\n      \"Scholarship Desk\"\n    ],\n    \"highlights\": [\n      {\n        \"title\": \"Learners\",\n        \"body\": \"455\"\n      },\n      {\n        \"title\": \"Staff Members\",\n        \"body\": \"44\"\n      },\n      {\n        \"title\": \"Profile Rating\",\n        \"body\": \"4.3\"\n      },\n      {\n        \"title\": \"Programs\",\n        \"body\": \"5\"\n      }\n    ],\n    \"quick_facts\": [\n      {\n        \"value\": \"455\",\n        \"label\": \"Learners\"\n      },\n      {\n        \"value\": \"44\",\n        \"label\": \"Staff Members\"\n      },\n      {\n        \"value\": \"4.3\",\n        \"label\": \"Profile Rating\"\n      },\n      {\n        \"value\": \"5\",\n        \"label\": \"Programs\"\n      }\n    ],\n    \"notices\": [],\n    \"staff\": [],\n    \"contact\": {\n      \"address\": \"Ward 5, Scholars Road, Palpa, Lumbini, Nepal\",\n      \"phone\": \"9810000685\",\n      \"email\": \"info@test-5.edu.np\",\n      \"website\": \"https://www.test-5.edu.np\"\n    },\n    \"social\": {\n      \"facebook\": \"https://facebook.com/test-5\",\n      \"instagram\": \"https://instagram.com/test-5\",\n      \"youtube\": \"https://youtube.com/@test-5\",\n      \"twitter\": \"https://x.com/test-5\"\n    }\n  }\n}";

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final Map<String, dynamic> payload = jsonDecode(kInstitutePayload) as Map<String, dynamic>;
  runApp(GeneratedInstituteApp(payload: payload));
}

class GeneratedInstituteApp extends StatelessWidget {
  const GeneratedInstituteApp({super.key, required this.payload});

  final Map<String, dynamic> payload;

  @override
  Widget build(BuildContext context) {
    final app = _mapValue(payload['app']);
    final seed = _parseColor(_text(app['theme_seed'], '#355DA8'));
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.light),
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: _text(app['app_name'], 'Institute App'),
      theme: base.copyWith(
        scaffoldBackgroundColor: const Color(0xFFF5F0E8),
        textTheme: GoogleFonts.manropeTextTheme(base.textTheme).copyWith(
          headlineLarge: GoogleFonts.sora(textStyle: base.textTheme.headlineLarge, fontWeight: FontWeight.w700),
          headlineMedium: GoogleFonts.sora(textStyle: base.textTheme.headlineMedium, fontWeight: FontWeight.w700),
          headlineSmall: GoogleFonts.sora(textStyle: base.textTheme.headlineSmall, fontWeight: FontWeight.w700),
          titleLarge: GoogleFonts.sora(textStyle: base.textTheme.titleLarge, fontWeight: FontWeight.w700),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
      ),
      home: InstituteShell(payload: payload),
    );
  }
}

class _PageItem {
  const _PageItem({required this.label, required this.icon});
  final String label;
  final IconData icon;
}

class InstituteShell extends StatefulWidget {
  const InstituteShell({super.key, required this.payload});

  final Map<String, dynamic> payload;

  @override
  State<InstituteShell> createState() => _InstituteShellState();
}

class _InstituteShellState extends State<InstituteShell> {
  static const List<_PageItem> _pages = <_PageItem>[
    _PageItem(label: 'Home', icon: Icons.home_rounded),
    _PageItem(label: 'Academics', icon: Icons.school_rounded),
    _PageItem(label: 'People', icon: Icons.groups_rounded),
    _PageItem(label: 'Media', icon: Icons.play_circle_outline_rounded),
    _PageItem(label: 'Updates', icon: Icons.campaign_rounded),
  ];

  int _currentIndex = 0;

  Map<String, dynamic> get _business => _mapValue(widget.payload['business']);
  Map<String, dynamic> get _app => _mapValue(widget.payload['app']);

  @override
  Widget build(BuildContext context) {
    final app = _app;
    final contact = _mapValue(app['contact']);
    final logoUrl = _text(app['logo_url']);
    final websiteUrl = _text(contact['website']);
    final screens = <Widget>[
      HomeScreen(business: _business, app: app, onNavigate: _navigateTo),
      AcademicsScreen(business: _business, app: app),
      PeopleScreen(business: _business, app: app),
      MediaScreen(business: _business, app: app),
      UpdatesScreen(business: _business, app: app),
    ];

    return Scaffold(
      extendBody: true,
      appBar: AppBar(
        titleSpacing: 0,
        title: _AppHeaderTitle(
          name: _text(app['app_name'], _text(_business['name'], 'Institute')),
          subtitle: _pages[_currentIndex].label,
          logoUrl: logoUrl,
        ),
        actions: [
          if (websiteUrl.isNotEmpty)
            IconButton(
              tooltip: 'Open website',
              onPressed: () => _openExternal(websiteUrl),
              icon: const Icon(Icons.open_in_new_rounded),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Colors.white.withOpacity(0.9),
              Theme.of(context).colorScheme.primary.withOpacity(0.06),
              const Color(0xFFF5F0E8),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: IndexedStack(
          index: _currentIndex,
          children: screens,
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _navigateTo,
        destinations: _pages
            .map(
              (page) => NavigationDestination(
                icon: Icon(page.icon),
                label: page.label,
              ),
            )
            .toList(),
      ),
    );
  }

  void _navigateTo(int index) {
    setState(() {
      _currentIndex = index;
    });
  }
}

class _AppHeaderTitle extends StatelessWidget {
  const _AppHeaderTitle({
    required this.name,
    required this.subtitle,
    required this.logoUrl,
  });

  final String name;
  final String subtitle;
  final String logoUrl;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _LogoAvatar(name: name, logoUrl: logoUrl, radius: 22),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.business,
    required this.app,
    required this.onNavigate,
  });

  final Map<String, dynamic> business;
  final Map<String, dynamic> app;
  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    final quickFacts = _blockList(app['quick_facts']);
    final highlights = _blockList(app['highlights']);
    final notices = _stringList(app['notices']);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 120),
      children: [
        _HomeHero(
          business: business,
          app: app,
          onNavigate: onNavigate,
        ),
        const SizedBox(height: 18),
        if (quickFacts.isNotEmpty) ...[
          const _SectionTitle(title: 'Quick Facts', subtitle: 'At a glance'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: quickFacts
                .map((item) => _MetricTile(value: _text(item['value']), label: _text(item['label'])))
                .toList(),
          ),
          const SizedBox(height: 22),
        ],
        const _SectionTitle(title: 'Introduction', subtitle: 'Institute overview'),
        _GlassCard(
          child: Text(
            _text(app['intro_body']),
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.65),
          ),
        ),
        if (highlights.isNotEmpty) ...[
          const SizedBox(height: 22),
          const _SectionTitle(title: 'Highlights', subtitle: 'What stands out'),
          const SizedBox(height: 12),
          ...highlights.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _DetailCard(
                title: _text(item['title']),
                body: _text(item['body']),
              ),
            ),
          ),
        ],
        if (_text(app['director_message']).isNotEmpty) ...[
          const SizedBox(height: 22),
          _DetailCard(
            title: _text(app['director_name'], 'Leadership message'),
            subtitle: _text(app['director_role']),
            body: _text(app['director_message']),
          ),
        ],
        if (notices.isNotEmpty) ...[
          const SizedBox(height: 22),
          const _SectionTitle(title: 'Current Notices', subtitle: 'Student-facing updates'),
          const SizedBox(height: 12),
          ...notices.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _NoticeCard(copy: item),
            ),
          ),
        ],
      ],
    );
  }
}


class AcademicsScreen extends StatelessWidget {
  const AcademicsScreen({
    super.key,
    required this.business,
    required this.app,
  });

  final Map<String, dynamic> business;
  final Map<String, dynamic> app;

  @override
  Widget build(BuildContext context) {
    final programs = _stringList(app['programs']);
    final facilities = _stringList(app['facilities']);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 120),
      children: [
        _SectionBanner(
          title: 'Academics & Facilities',
          subtitle: _text(business['type'], 'Institute') + ' · ' + _text(business['locationLabel']),
        ),
        const SizedBox(height: 18),
        const _SectionTitle(title: 'Programs', subtitle: 'Learning pathways'),
        const SizedBox(height: 12),
        if (programs.isNotEmpty)
          ...programs.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _DetailCard(
                title: item,
                body: 'Configured from Generator Studio and editable at any time before rebuilding the app.',
              ),
            ),
          )
        else
          const _EmptyCard(copy: 'Add programs in Generator Studio to build a stronger academics screen.'),
        const SizedBox(height: 22),
        const _SectionTitle(title: 'Facilities', subtitle: 'Campus support'),
        const SizedBox(height: 12),
        if (facilities.isNotEmpty)
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: facilities.map((item) => _TagChip(label: item)).toList(),
          )
        else
          const _EmptyCard(copy: 'Add facilities in Generator Studio to highlight labs, transport, libraries, and support services.'),
        if (_text(app['admissions_note']).isNotEmpty) ...[
          const SizedBox(height: 22),
          const _SectionTitle(title: 'Admissions', subtitle: 'Enrollment guidance'),
          const SizedBox(height: 12),
          _GlassCard(
            child: Text(
              _text(app['admissions_note']),
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.65),
            ),
          ),
        ],
      ],
    );
  }
}

class PeopleScreen extends StatelessWidget {
  const PeopleScreen({
    super.key,
    required this.business,
    required this.app,
  });

  final Map<String, dynamic> business;
  final Map<String, dynamic> app;

  @override
  Widget build(BuildContext context) {
    final staff = _blockList(app['staff']);
    final notices = _stringList(app['notices']);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 120),
      children: [
        _SectionBanner(
          title: 'Leadership & People',
          subtitle: _text(business['name']),
        ),
        if (_text(app['director_message']).isNotEmpty) ...[
          const SizedBox(height: 18),
          _DetailCard(
            title: _text(app['director_name'], 'Institute lead'),
            subtitle: _text(app['director_role']),
            body: _text(app['director_message']),
          ),
        ],
        const SizedBox(height: 22),
        const _SectionTitle(title: 'Staff', subtitle: 'Faculty and team'),
        const SizedBox(height: 12),
        if (staff.isNotEmpty)
          ...staff.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _StaffCard(
                name: _text(item['name'], 'Staff Member'),
                role: _text(item['role']),
                bio: _text(item['bio']),
                imageUrl: _text(item['image']),
              ),
            ),
          )
        else
          const _EmptyCard(copy: 'Add staff profiles in Generator Studio to build a proper people screen.'),
        if (notices.isNotEmpty) ...[
          const SizedBox(height: 22),
          const _SectionTitle(title: 'Announcements', subtitle: 'Community updates'),
          const SizedBox(height: 12),
          ...notices.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _NoticeCard(copy: item),
            ),
          ),
        ],
      ],
    );
  }
}

class MediaScreen extends StatelessWidget {
  const MediaScreen({
    super.key,
    required this.business,
    required this.app,
  });

  final Map<String, dynamic> business;
  final Map<String, dynamic> app;

  @override
  Widget build(BuildContext context) {
    final gallery = _stringList(app['gallery']);
    final videos = _blockList(app['videos']);
    final fallbackImage = _firstNonEmpty(<String>[
      _text(app['hero_image_url']),
      ...gallery,
    ]);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 120),
      children: [
        _SectionBanner(
          title: 'Media',
          subtitle: 'Gallery and playable video cards',
        ),
        const SizedBox(height: 18),
        const _SectionTitle(title: 'Gallery', subtitle: 'Visual identity'),
        const SizedBox(height: 12),
        if (gallery.isNotEmpty)
          SizedBox(
            height: 220,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: gallery.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final item = gallery[index];
                return _GalleryTile(url: item, fallbackLabel: 'Image ' + (index + 1).toString());
              },
            ),
          )
        else
          const _EmptyCard(copy: 'Add gallery image links in Generator Studio to build this section.'),
        const SizedBox(height: 22),
        const _SectionTitle(title: 'Videos', subtitle: 'Tap a card to play'),
        const SizedBox(height: 12),
        if (videos.isNotEmpty)
          ...videos.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _VideoCard(
                title: _text(item['title'], 'Institute video'),
                url: _text(item['url']),
                fallbackImage: fallbackImage,
              ),
            ),
          )
        else
          const _EmptyCard(copy: 'Add YouTube, Vimeo, or direct video links in Generator Studio to create playable cards.'),
      ],
    );
  }
}

class UpdatesScreen extends StatelessWidget {
  const UpdatesScreen({
    super.key,
    required this.business,
    required this.app,
  });

  final Map<String, dynamic> business;
  final Map<String, dynamic> app;

  @override
  Widget build(BuildContext context) {
    final contact = _mapValue(app['contact']);
    final social = _mapValue(app['social']);
    final facebook = _text(social['facebook']);
    final youtube = _text(social['youtube']);

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 120),
      children: [
        _SectionBanner(
          title: 'Updates & Contact',
          subtitle: 'Official channels and next actions',
        ),
        const SizedBox(height: 18),
        const _SectionTitle(title: 'Contact', subtitle: 'Reach the institute'),
        const SizedBox(height: 12),
        _ContactActionCard(
          title: _text(app['contact_headline'], 'Reach the institute'),
          address: _text(contact['address']),
          phone: _text(contact['phone']),
          email: _text(contact['email']),
          website: _text(contact['website']),
        ),
        const SizedBox(height: 22),
        const _SectionTitle(title: 'Social Channels', subtitle: 'Live public presence'),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            if (facebook.isNotEmpty) _ActionChip(label: 'Facebook', icon: Icons.thumb_up_alt_rounded, onTap: () => _openExternal(facebook)),
            if (youtube.isNotEmpty) _ActionChip(label: 'YouTube', icon: Icons.ondemand_video_rounded, onTap: () => _openExternal(youtube)),
            if (_text(social['instagram']).isNotEmpty) _ActionChip(label: 'Instagram', icon: Icons.photo_camera_back_rounded, onTap: () => _openExternal(_text(social['instagram']))),
            if (_text(social['twitter']).isNotEmpty) _ActionChip(label: 'X', icon: Icons.chat_bubble_outline_rounded, onTap: () => _openExternal(_text(social['twitter']))),
          ],
        ),
        if (facebook.isEmpty && youtube.isEmpty && _text(social['instagram']).isEmpty && _text(social['twitter']).isEmpty) ...[
          const SizedBox(height: 12),
          const _EmptyCard(copy: 'Add social links in Generator Studio to show live public channels here.'),
        ],
        if (facebook.isNotEmpty) ...[
          const SizedBox(height: 22),
          const _SectionTitle(title: 'Facebook Updates', subtitle: 'Embedded page feed'),
          const SizedBox(height: 12),
          _SocialFeedCard(
            title: 'Facebook timeline',
            url: _facebookPluginUrl(facebook),
          ),
        ],
        if (youtube.isNotEmpty) ...[
          const SizedBox(height: 22),
          const _SectionTitle(title: 'YouTube Updates', subtitle: 'Official channel view'),
          const SizedBox(height: 12),
          _SocialFeedCard(
            title: 'YouTube channel',
            url: youtube,
          ),
        ],
      ],
    );
  }
}


class _HomeHero extends StatelessWidget {
  const _HomeHero({
    required this.business,
    required this.app,
    required this.onNavigate,
  });

  final Map<String, dynamic> business;
  final Map<String, dynamic> app;
  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    final title = _text(app['intro_title'], _text(business['name'], 'Institute'));
    final subtitle = _text(app['app_tagline'], _text(business['type']));
    final summary = _text(app['intro_body']);
    final imageUrl = _text(app['hero_image_url']);

    return _GlassCard(
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: SizedBox(
          height: 320,
          child: Stack(
            fit: StackFit.expand,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Theme.of(context).colorScheme.primary.withOpacity(0.92),
                      Theme.of(context).colorScheme.secondary.withOpacity(0.62),
                      const Color(0xFF0F172A),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
              if (imageUrl.isNotEmpty)
                Opacity(
                  opacity: 0.24,
                  child: Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.all(22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _LogoAvatar(name: _text(app['app_name'], title), logoUrl: _text(app['logo_url']), radius: 30),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _text(app['app_name'], title),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                              if (subtitle.isNotEmpty)
                                Text(
                                  subtitle,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        color: Colors.white.withOpacity(0.84),
                                      ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Text(
                      title,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      summary,
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Colors.white.withOpacity(0.88),
                            height: 1.55,
                          ),
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _ActionChip(
                          label: 'Open Media',
                          icon: Icons.play_circle_fill_rounded,
                          onTap: () => onNavigate(3),
                          isPrimary: true,
                        ),
                        _ActionChip(
                          label: 'See Updates',
                          icon: Icons.campaign_rounded,
                          onTap: () => onNavigate(4),
                          isPrimary: false,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionBanner extends StatelessWidget {
  const _SectionBanner({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            subtitle,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          subtitle,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: Theme.of(context).colorScheme.primary,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}

class _GlassCard extends StatelessWidget {
  const _GlassCard({
    required this.child,
    this.padding = const EdgeInsets.all(20),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: _softCardDecoration(context),
      child: child,
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 156,
      padding: const EdgeInsets.all(18),
      decoration: _softCardDecoration(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black54),
          ),
        ],
      ),
    );
  }
}

class _DetailCard extends StatelessWidget {
  const _DetailCard({
    required this.title,
    required this.body,
    this.subtitle = '',
  });

  final String title;
  final String subtitle;
  final String body;

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (subtitle.isNotEmpty)
            Text(
              subtitle,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                  ),
            ),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          if (body.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              body,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.62),
            ),
          ],
        ],
      ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({required this.copy});

  final String copy;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Theme.of(context).colorScheme.primary.withOpacity(0.18)),
      ),
      child: Text(
        copy,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.55),
      ),
    );
  }
}

class _StaffCard extends StatelessWidget {
  const _StaffCard({
    required this.name,
    required this.role,
    required this.bio,
    required this.imageUrl,
  });

  final String name;
  final String role;
  final String bio;
  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _LogoAvatar(name: name, logoUrl: imageUrl, radius: 34),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
                if (role.isNotEmpty)
                  Text(
                    role,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black54),
                  ),
                if (bio.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    bio,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.55),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}


class _GalleryTile extends StatelessWidget {
  const _GalleryTile({required this.url, required this.fallbackLabel});

  final String url;
  final String fallbackLabel;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: SizedBox(
        width: 250,
        child: DecoratedBox(
          decoration: _softCardDecoration(context),
          child: Image.network(
            url,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _ImageFallback(label: fallbackLabel),
          ),
        ),
      ),
    );
  }
}

class _VideoCard extends StatelessWidget {
  const _VideoCard({
    required this.title,
    required this.url,
    required this.fallbackImage,
  });

  final String title;
  final String url;
  final String fallbackImage;

  @override
  Widget build(BuildContext context) {
    final previewImage = _videoPreviewImage(url, fallbackImage);
    return _GlassCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            child: SizedBox(
              height: 190,
              width: double.infinity,
              child: previewImage.isNotEmpty
                  ? Image.network(
                      previewImage,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _ImageFallback(label: 'Video'),
                    )
                  : const _ImageFallback(label: 'Video'),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                Text(
                  _videoTypeLabel(url),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  url,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black54),
                ),
                const SizedBox(height: 14),
                FilledButton.tonalIcon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => VideoPlayerPage(title: title, url: url),
                      ),
                    );
                  },
                  icon: const Icon(Icons.play_arrow_rounded),
                  label: const Text('Play video'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactActionCard extends StatelessWidget {
  const _ContactActionCard({
    required this.title,
    required this.address,
    required this.phone,
    required this.email,
    required this.website,
  });

  final String title;
  final String address;
  final String phone;
  final String email;
  final String website;

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          if (address.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(address, style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.55)),
          ],
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              if (phone.isNotEmpty) _ActionChip(label: 'Call', icon: Icons.call_rounded, onTap: () => _openExternal('tel:' + phone)),
              if (email.isNotEmpty) _ActionChip(label: 'Email', icon: Icons.mail_outline_rounded, onTap: () => _openExternal('mailto:' + email)),
              if (website.isNotEmpty) _ActionChip(label: 'Website', icon: Icons.language_rounded, onTap: () => _openExternal(website), isPrimary: true),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.label,
    required this.icon,
    required this.onTap,
    this.isPrimary = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    if (isPrimary) {
      return FilledButton.tonalIcon(
        onPressed: onTap,
        icon: Icon(icon),
        label: Text(label),
      );
    }
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon),
      label: Text(label),
    );
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.92),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.7)),
      ),
      child: Text(label),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.copy});

  final String copy;

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      child: Text(
        copy,
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.55),
      ),
    );
  }
}

class _LogoAvatar extends StatelessWidget {
  const _LogoAvatar({
    required this.name,
    required this.logoUrl,
    required this.radius,
  });

  final String name;
  final String logoUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final size = radius * 2;
    final fallback = _ImageFallback(label: _initials(name));
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius * 0.78),
      child: SizedBox(
        width: size,
        height: size,
        child: logoUrl.isNotEmpty
            ? Image.network(
                logoUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => fallback,
              )
            : fallback,
      ),
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primary.withOpacity(0.18),
            Theme.of(context).colorScheme.secondary.withOpacity(0.1),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Text(
          label,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.w800,
              ),
        ),
      ),
    );
  }
}

class _SocialFeedCard extends StatefulWidget {
  const _SocialFeedCard({
    required this.title,
    required this.url,
  });

  final String title;
  final String url;

  @override
  State<_SocialFeedCard> createState() => _SocialFeedCardState();
}

class _SocialFeedCardState extends State<_SocialFeedCard> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..loadRequest(Uri.parse(widget.url));
  }

  @override
  Widget build(BuildContext context) {
    return _GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: SizedBox(
              height: 360,
              child: WebViewWidget(controller: _controller),
            ),
          ),
        ],
      ),
    );
  }
}

class VideoPlayerPage extends StatefulWidget {
  const VideoPlayerPage({
    super.key,
    required this.title,
    required this.url,
  });

  final String title;
  final String url;

  @override
  State<VideoPlayerPage> createState() => _VideoPlayerPageState();
}

class _VideoPlayerPageState extends State<VideoPlayerPage> {
  VideoPlayerController? _controller;
  Future<void>? _initializeFuture;
  WebViewController? _webController;
  late final String _embedUrl;

  @override
  void initState() {
    super.initState();
    _embedUrl = _embedUrlForVideo(widget.url);
    if (_isDirectVideoUrl(widget.url)) {
      final controller = VideoPlayerController.networkUrl(Uri.parse(widget.url));
      _controller = controller;
      _initializeFuture = controller.initialize();
    } else {
      final webController = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted);
      if (_embedUrl.isNotEmpty) {
        webController.loadHtmlString(_videoEmbedDocument(_embedUrl, widget.title));
      } else {
        webController.loadRequest(Uri.parse(widget.url));
      }
      _webController = webController;
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Padding(
        padding: const EdgeInsets.all(18),
        child: _controller != null
            ? FutureBuilder<void>(
                future: _initializeFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final controller = _controller!;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: AspectRatio(
                          aspectRatio: controller.value.aspectRatio == 0 ? 16 / 9 : controller.value.aspectRatio,
                          child: VideoPlayer(controller),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Wrap(
                        spacing: 10,
                        children: [
                          FilledButton.tonalIcon(
                            onPressed: () {
                              if (controller.value.isPlaying) {
                                controller.pause();
                              } else {
                                controller.play();
                              }
                              setState(() {});
                            },
                            icon: Icon(controller.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded),
                            label: Text(controller.value.isPlaying ? 'Pause' : 'Play'),
                          ),
                          OutlinedButton.icon(
                            onPressed: () => _openExternal(widget.url),
                            icon: const Icon(Icons.open_in_new_rounded),
                            label: const Text('Open source'),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              )
            : ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: WebViewWidget(controller: _webController!),
              ),
      ),
    );
  }
}


BoxDecoration _softCardDecoration(BuildContext context) {
  return BoxDecoration(
    color: Colors.white.withOpacity(0.84),
    borderRadius: BorderRadius.circular(28),
    border: Border.all(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.34)),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(0.06),
        blurRadius: 24,
        offset: const Offset(0, 10),
      ),
    ],
  );
}

Map<String, dynamic> _mapValue(dynamic input) {
  if (input is Map<String, dynamic>) return input;
  if (input is Map) return input.map((key, value) => MapEntry(key.toString(), value));
  return <String, dynamic>{};
}

List<Map<String, dynamic>> _blockList(dynamic input) {
  if (input is! List) return <Map<String, dynamic>>[];
  return input.map<Map<String, dynamic>>((item) => _mapValue(item)).where((item) => item.isNotEmpty).toList();
}

List<String> _stringList(dynamic input) {
  if (input is! List) return <String>[];
  return input.map((item) => item?.toString().trim() ?? '').where((item) => item.isNotEmpty).toList();
}

String _text(dynamic value, [String fallback = '']) {
  final text = value?.toString().trim() ?? '';
  return text.isNotEmpty ? text : fallback;
}

String _firstNonEmpty(List<String> values) {
  for (final value in values) {
    if (value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return '';
}

Color _parseColor(String value) {
  final cleaned = value.replaceAll('#', '').trim();
  final hex = cleaned.length == 6 ? 'FF' + cleaned : cleaned;
  return Color(int.tryParse(hex, radix: 16) ?? 0xFF355DA8);
}

bool _isDirectVideoUrl(String url) {
  return RegExp(r'\.(mp4|webm|ogg)(\?.*)?$', caseSensitive: false).hasMatch(url);
}

String _embedUrlForVideo(String url) {
  final uri = Uri.tryParse(url);
  if (uri == null) return '';
  final host = uri.host.toLowerCase();
  if (host.contains('youtu.be')) {
    final id = uri.pathSegments.where((segment) => segment.isNotEmpty).join();
    return id.isNotEmpty ? 'https://www.youtube.com/embed/' + id : '';
  }
  if (host.contains('youtube.com')) {
    final id = uri.queryParameters['v'] ?? '';
    return id.isNotEmpty ? 'https://www.youtube.com/embed/' + id : '';
  }
  if (host.contains('vimeo.com')) {
    final id = uri.pathSegments.where((segment) => segment.isNotEmpty).toList().isNotEmpty
        ? uri.pathSegments.where((segment) => segment.isNotEmpty).last
        : '';
    return id.isNotEmpty ? 'https://player.vimeo.com/video/' + id : '';
  }
  return '';
}

String _videoPreviewImage(String url, String fallback) {
  final uri = Uri.tryParse(url);
  if (uri != null) {
    final host = uri.host.toLowerCase();
    if (host.contains('youtu.be')) {
      final id = uri.pathSegments.where((segment) => segment.isNotEmpty).join();
      if (id.isNotEmpty) return 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
    }
    if (host.contains('youtube.com')) {
      final id = uri.queryParameters['v'] ?? '';
      if (id.isNotEmpty) return 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
    }
  }
  return fallback;
}

String _videoTypeLabel(String url) {
  if (_isDirectVideoUrl(url)) return 'Direct video';
  if (_embedUrlForVideo(url).contains('youtube')) return 'YouTube';
  if (_embedUrlForVideo(url).contains('vimeo')) return 'Vimeo';
  return 'External video';
}

String _facebookPluginUrl(String url) {
  return 'https://www.facebook.com/plugins/page.php?href=' +
      Uri.encodeComponent(url) +
      '&tabs=timeline&width=500&height=720&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true';
}

String _videoEmbedDocument(String embedUrl, String title) {
  return '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;background:#000;"><iframe src="' +
      embedUrl +
      '" title="' +
      title.replaceAll('"', '&quot;') +
      '" style="border:0;width:100vw;height:100vh;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></body></html>';
}

Future<void> _openExternal(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

String _initials(String value) {
  final parts = value.trim().split(RegExp(r'\s+')).where((part) => part.isNotEmpty).toList();
  if (parts.isEmpty) return 'I';
  final first = parts.first[0].toUpperCase();
  final second = parts.length > 1 ? parts.last[0].toUpperCase() : '';
  return first + second;
}
