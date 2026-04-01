import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { DATA_SOURCE, fetchBusinessDetail, fetchBusinessList } from "./data-source";

const BASIC_CACHE_KEY = "edudata-user-basic-v5";
const SAVED_CACHE_KEY = "edudata-user-saved-v1";
const ROTATION_CACHE_KEY = "edudata-user-rotation-v1";

export default function App() {
  const [businesses, setBusinesses] = useState(() => readCache(BASIC_CACHE_KEY, [], "local"));
  const [savedSlugs, setSavedSlugs] = useState(() => readCache(SAVED_CACHE_KEY, [], "local"));
  const [rotationProfile, setRotationProfile] = useState(() =>
    readCache(ROTATION_CACHE_KEY, { cycle: 0, fingerprint: "" }, "local")
  );
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedBusinessDetail, setSelectedBusinessDetail] = useState(null);
  const [activeVideo, setActiveVideo] = useState(null);
  const [loading, setLoading] = useState(() => readCache(BASIC_CACHE_KEY, [], "local").length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [detailErrorMessage, setDetailErrorMessage] = useState("");
  const [detailLoadingSlug, setDetailLoadingSlug] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    field: "all",
    level: "all",
    province: "all",
    district: "all",
    affiliation: "all",
    savedOnly: false,
  });
  const deferredSearch = useDeferredValue(filters.search);

  useEffect(() => {
    let cancelled = false;

    async function refreshDirectory() {
      setRefreshing(true);
      try {
        const nextBusinesses = await fetchBusinessList();
        if (cancelled) {
          return;
        }

        const orderedBusinesses = nextBusinesses;
        setBusinesses(orderedBusinesses);
        writeCache(BASIC_CACHE_KEY, orderedBusinesses, "local");
        setRotationProfile((current) => {
          const next = buildNextRotationProfile(current, orderedBusinesses);
          writeCache(ROTATION_CACHE_KEY, next, "local");
          return next;
        });
        setErrorMessage("");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          businesses.length
            ? "Live data is unavailable. Showing the last cached directory."
            : error.message || "Unable to load the directory."
        );
      } finally {
        if (!cancelled) {
          setRefreshing(false);
          setLoading(false);
        }
      }
    }

    refreshDirectory();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSlug) {
      setSelectedBusinessDetail(null);
      setDetailErrorMessage("");
      setDetailLoadingSlug("");
      return;
    }

    if (businesses.length && !businesses.some((business) => business.slug === selectedSlug)) {
      setSelectedBusinessDetail(null);
      setDetailErrorMessage("");
      startTransition(() => {
        setSelectedSlug("");
      });
      return;
    }

    let cancelled = false;
    setSelectedBusinessDetail(null);
    setDetailErrorMessage("");
    setDetailLoadingSlug(selectedSlug);

    fetchBusinessDetail(selectedSlug)
      .then((detail) => {
        if (cancelled || !detail) {
          return;
        }

        setSelectedBusinessDetail(detail);
        setErrorMessage("");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setSelectedBusinessDetail(null);
        setDetailErrorMessage(error.message || "Unable to load the selected business.");
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoadingSlug("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSlug, businesses]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    if (selectedSlug || activeVideo) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow || "";
    }

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [selectedSlug, activeVideo]);

  useEffect(() => {
    if (typeof document === "undefined" || (!selectedSlug && !activeVideo)) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (activeVideo) {
          setActiveVideo(null);
          return;
        }

        if (selectedSlug) {
          startTransition(() => {
            setSelectedSlug("");
          });
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedSlug, activeVideo]);

  const filteredBusinesses = businesses.filter((business) =>
    matchesFilters(business, filters, deferredSearch, savedSlugs)
  );
  const visibleBusinesses = rotateBusinessesForDisplay(filteredBusinesses, rotationProfile, {
    ...filters,
    search: deferredSearch,
  });
  const selectedBusinessSummary = selectedSlug
    ? businesses.find((business) => business.slug === selectedSlug) || null
    : null;
  const selectedBusiness = selectedSlug
    ? mergeBusinessSnapshot(selectedBusinessSummary, selectedBusinessDetail)
    : null;
  const selectedBusinessCoverImage = selectedBusiness ? getPreferredCoverImage(selectedBusiness) : "";
  const detailIsLoading = detailLoadingSlug === selectedSlug;
  const provinceCount = uniqueValues(
    businesses.map((business) => business.province_name || business.province)
  ).length;
  const fieldCount = uniqueValues(businesses.flatMap((business) => business.field || [])).length;
  const savedCount = savedSlugs.filter((slug) => businesses.some((business) => business.slug === slug)).length;
  const typeOptions = uniqueValues(businesses.map((business) => business.type));
  const fieldOptions = uniqueValues(businesses.flatMap((business) => business.field || []));
  const levelOptions = uniqueValues(businesses.flatMap((business) => business.level || []));
  const provinceOptions = uniqueValues(
    businesses.map((business) => business.province_name || business.province)
  );
  const affiliationOptions = uniqueValues(businesses.map((business) => business.affiliation));
  const districtOptions = uniqueValues(
    businesses
      .filter((business) =>
        filters.province === "all"
          ? true
          : (business.province_name || business.province) === filters.province
      )
      .map((business) => business.district)
  );

  function handleSelectBusiness(slug) {
    setSelectedBusinessDetail(null);
    setDetailErrorMessage("");
    startTransition(() => {
      setSelectedSlug(slug);
    });
    setErrorMessage("");
  }

  function closeDetail() {
    setActiveVideo(null);
    setSelectedBusinessDetail(null);
    setDetailErrorMessage("");
    startTransition(() => {
      setSelectedSlug("");
    });
  }

  function handleFilterChange(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "province" ? { district: "all" } : {}),
    }));
  }

  function resetFilters() {
    setFilters({
      search: "",
      type: "all",
      field: "all",
      level: "all",
      province: "all",
      district: "all",
      affiliation: "all",
      savedOnly: false,
    });
  }

  function toggleSavedBusiness(slug) {
    setSavedSlugs((current) => {
      const next = current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [slug, ...current.filter((item) => item !== slug)];
      writeCache(SAVED_CACHE_KEY, next, "local");
      return next;
    });
  }

  function handleOpenVideo(video) {
    setActiveVideo(video);
  }

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-a" />
      <div className="bg-orb bg-orb-b" />
      <div className="app-frame">
        <header className="topbar glass-panel">
          <div className="hero-copy">
            <p className="eyebrow">Student Directory</p>
            <h1>Find the right educational institute quickly.</h1>
            <p className="hero-text">
              Browse active institutions through consistent cards, click into the details only when
              you need them, and save the ones you like locally on this device.
            </p>
          </div>

          <div className="hero-stats">
            <StatTile label="Institutes" value={businesses.length} />
            <StatTile label="Saved" value={savedCount} />
            <StatTile label="Provinces" value={provinceCount} />
            <StatTile label="Fields" value={fieldCount} />
          </div>
        </header>

        <section className="toolbar glass-panel">
          <div className="search-wrap">
            <span className="search-hint">Search</span>
            <input
              className="search-input"
              type="search"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              placeholder="Search by name, district, field, program, or affiliation"
            />
          </div>

          <div className="toolbar-meta">
            <span>{visibleBusinesses.length} matches</span>
            <span>{`Source: ${DATA_SOURCE.label}`}</span>
            <span>{`Rotation: cycle ${rotationProfile?.cycle || 0}`}</span>
            <span>Detail fetch: live</span>
            <span>{refreshing ? "Syncing files" : "Ready"}</span>
          </div>

          <div className="chip-row">
            <FilterChip
              active={filters.savedOnly}
              onClick={() => handleFilterChange("savedOnly", !filters.savedOnly)}
            >
              Saved only
            </FilterChip>
            <FilterChip
              active={filters.type === "all"}
              onClick={() => handleFilterChange("type", "all")}
            >
              All types
            </FilterChip>
            {typeOptions.map((type) => (
              <FilterChip
                key={type}
                active={filters.type === type}
                onClick={() => handleFilterChange("type", type)}
              >
                {type}
              </FilterChip>
            ))}
          </div>

          <div className="filter-grid">
            <FilterSelect
              label="Field"
              value={filters.field}
              onChange={(nextValue) => handleFilterChange("field", nextValue)}
              options={fieldOptions}
              emptyLabel="All fields"
            />
            <FilterSelect
              label="Level"
              value={filters.level}
              onChange={(nextValue) => handleFilterChange("level", nextValue)}
              options={levelOptions}
              emptyLabel="All levels"
            />
            <FilterSelect
              label="Province"
              value={filters.province}
              onChange={(nextValue) => handleFilterChange("province", nextValue)}
              options={provinceOptions}
              emptyLabel="All provinces"
            />
            <FilterSelect
              label="District"
              value={filters.district}
              onChange={(nextValue) => handleFilterChange("district", nextValue)}
              options={districtOptions}
              emptyLabel="All districts"
            />
            <FilterSelect
              label="Affiliation"
              value={filters.affiliation}
              onChange={(nextValue) => handleFilterChange("affiliation", nextValue)}
              options={affiliationOptions}
              emptyLabel="All affiliations"
            />
            <button className="ghost-button" type="button" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        </section>

        {errorMessage ? <div className="status-banner">{errorMessage}</div> : null}

        <main className="content-grid">
          <section className="results-pane">
            {loading ? (
              <div className="card-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </div>
            ) : visibleBusinesses.length ? (
              <div className="card-grid">
                {visibleBusinesses.map((business) => (
                  <BusinessCard
                    key={business.slug}
                    business={business}
                    isSelected={business.slug === selectedSlug}
                    onSelect={handleSelectBusiness}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-panel glass-panel">
                <h2>No institutes match this filter set.</h2>
                <p>Try clearing one or two filters, or search with a district, level, or field.</p>
              </div>
            )}
          </section>
        </main>

        {selectedBusiness ? (
          <aside className="detail-pane" role="dialog" aria-modal="true" aria-label={selectedBusiness.name}>
            <div className="detail-overlay" onClick={closeDetail} />
            <div className="detail-card glass-panel">
              <section
                className="detail-hero"
                style={{ background: buildGradient(selectedBusiness.slug) }}
              >
                {selectedBusinessCoverImage ? (
                  <img
                    className="detail-cover-image"
                    src={selectedBusinessCoverImage}
                    alt={`${selectedBusiness.name} cover`}
                  />
                ) : null}
                <div className="detail-hero-backdrop" />
                <div className="detail-hero-actions">
                  <button
                    type="button"
                    className={`save-button detail-save-button ${savedSlugs.includes(selectedBusiness.slug) ? "saved" : ""}`}
                    onClick={() => toggleSavedBusiness(selectedBusiness.slug)}
                  >
                    {savedSlugs.includes(selectedBusiness.slug) ? "Saved" : "Save"}
                  </button>
                </div>
                <div className="detail-brand">
                  {!selectedBusinessCoverImage ? (
                    <div className="detail-logo">{getInitials(selectedBusiness.name)}</div>
                  ) : null}
                  <div className="detail-head-copy">
                    <p className="eyebrow">{selectedBusiness.type || "Institute"}</p>
                    <h2>{selectedBusiness.name}</h2>
                    <p className="detail-location">{buildBusinessLocationLine(selectedBusiness)}</p>
                  </div>
                </div>
              </section>

              <section className="detail-body">
                {detailIsLoading ? (
                  <div className="detail-loading">Loading the full profile.</div>
                ) : null}
                {detailErrorMessage ? (
                  <div className="detail-loading detail-error">{detailErrorMessage}</div>
                ) : null}

                <SectionBlock title="Overview">
                  <p className="body-copy">
                    {selectedBusiness.description ||
                      "A concise profile is not available yet. The listing still includes its location, contact details, programs, and facilities."}
                  </p>
                  <div className="info-grid">
                    <InfoItem
                      label="Affiliation"
                      value={selectedBusiness.affiliation || "Not set"}
                    />
                    <InfoItem
                      label="Levels"
                      value={formatArray(selectedBusiness.level) || "Not set"}
                    />
                    <InfoItem
                      label="Fields"
                      value={formatArray(selectedBusiness.field) || "Not set"}
                    />
                    <InfoItem
                      label="Programs"
                      value={String(
                        selectedBusiness.stats?.programs_count ||
                          selectedBusiness.programs?.length ||
                          0
                      )}
                    />
                  </div>
                </SectionBlock>

                <SectionBlock title="Programs">
                  <TagList
                    items={selectedBusiness.programs}
                    emptyLabel="Programs have not been listed yet."
                  />
                </SectionBlock>

                <SectionBlock title="Facilities">
                  <TagList
                    items={selectedBusiness.facilities}
                    emptyLabel="Facilities have not been listed yet."
                  />
                </SectionBlock>

                <SectionBlock title="Location">
                  <BusinessLocationSection business={selectedBusiness} />
                </SectionBlock>

                <SectionBlock title="Gallery">
                  <GallerySection items={selectedBusiness.media?.gallery} />
                </SectionBlock>

                <SectionBlock title="Videos">
                  <VideoSection
                    items={selectedBusiness.media?.videos}
                    onOpenVideo={handleOpenVideo}
                  />
                </SectionBlock>

                <SectionBlock title="Contact">
                  <div className="contact-stack">
                    <InfoItem
                      label="Address"
                      value={selectedBusiness.contact?.address || "Address not set"}
                    />
                    <InfoItem
                      label="Phone"
                      value={formatArray(selectedBusiness.contact?.phone) || "Phone not set"}
                    />
                    <InfoItem
                      label="Email"
                      value={selectedBusiness.contact?.email || "Email not set"}
                    />
                    <InfoItem
                      label="Website"
                      value={selectedBusiness.contact?.website || "Website not set"}
                    />
                  </div>
                  <div className="icon-action-row">
                    <IconActionLink
                      label="Email"
                      href={
                        selectedBusiness.contact?.email
                          ? `mailto:${selectedBusiness.contact.email}`
                          : ""
                      }
                      icon="email"
                    />
                    <IconActionLink
                      label="Website"
                      href={
                        selectedBusiness.contact?.website
                          ? ensureUrl(selectedBusiness.contact.website)
                          : ""
                      }
                      icon="website"
                      external
                    />
                    <IconActionLink
                      label="Map"
                      href={getBusinessMapInfo(selectedBusiness)?.openUrl || ""}
                      icon="map"
                      external
                    />
                  </div>
                </SectionBlock>

                <SectionBlock title="Social">
                  <div className="icon-action-row">
                    <IconActionLink
                      label="Facebook"
                      href={selectedBusiness.social?.facebook}
                      icon="facebook"
                      external
                    />
                    <IconActionLink
                      label="Instagram"
                      href={selectedBusiness.social?.instagram}
                      icon="instagram"
                      external
                    />
                    <IconActionLink
                      label="YouTube"
                      href={selectedBusiness.social?.youtube}
                      icon="youtube"
                      external
                    />
                    <IconActionLink
                      label="Twitter / X"
                      href={selectedBusiness.social?.twitter}
                      icon="twitter"
                      external
                    />
                  </div>
                </SectionBlock>
              </section>
            </div>
          </aside>
        ) : null}
        {activeVideo ? (
          <div className="video-lightbox" role="dialog" aria-modal="true" aria-label={activeVideo.title}>
            <div className="video-lightbox-overlay" onClick={() => setActiveVideo(null)} />
            <div className="video-lightbox-card glass-panel">
              <button
                type="button"
                className="video-lightbox-close"
                onClick={() => setActiveVideo(null)}
              >
                Close
              </button>
              <div className="video-lightbox-head">
                <p className="eyebrow">{activeVideo.provider}</p>
                <h3>{activeVideo.title}</h3>
              </div>
              <div className="video-lightbox-player">
                {activeVideo.embedUrl ? (
                  <iframe
                    src={activeVideo.embedUrl}
                    title={activeVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : activeVideo.isDirectVideo ? (
                  <video className="video-modal-player" controls autoPlay preload="metadata">
                    <source src={activeVideo.url} />
                  </video>
                ) : (
                  <div className="video-lightbox-fallback">
                    <p>This video source cannot be played inside the popup.</p>
                    <a
                      href={activeVideo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="media-open-button"
                    >
                      Open source
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BusinessCard({ business, isSelected, onSelect }) {
  const coverImage = getPreferredCoverImage(business);
  const address = getBusinessCardAddress(business);
  const phone = getPrimaryPhone(business.contact?.phone);
  const email = String(business.contact?.email || "").trim();
  const website = String(business.contact?.website || "").trim();
  const isCertified = isCertifiedBusiness(business);

  return (
    <article className={`business-card ${isSelected ? "selected" : ""}`}>
      <button
        type="button"
        className="business-card-action"
        onClick={() => onSelect(business.slug)}
      >
        <div className="card-cover" style={{ background: buildGradient(business.slug) }}>
          {isCertified ? (
            <span
              className="card-certified-badge"
              title="Physically certified"
              aria-label="Physically certified"
            >
              <span className="card-certified-icon" aria-hidden="true">
                ✓
              </span>
              <span>Certified</span>
            </span>
          ) : null}
          {coverImage ? (
            <img
              className="card-cover-image"
              src={coverImage}
              alt={`${business.name} cover`}
              loading="lazy"
            />
          ) : null}
          <div className="card-cover-sheen" />
        </div>

        <div className="card-body card-body-compact">
          <div className="card-main">
            <h2 className="card-title card-title-large">{business.name}</h2>
            <p className="card-address">{address}</p>
          </div>
        </div>
      </button>

      <div className="card-actions">
        <button type="button" className="card-link-button primary" onClick={() => onSelect(business.slug)}>
          Go
        </button>
        <CardActionLink label="Call" href={phone ? `tel:${phone}` : ""} />
        <CardActionLink label="Email" href={email ? `mailto:${email}` : ""} />
        <CardActionLink label="Website" href={website ? ensureUrl(website) : ""} external />
      </div>
    </article>
  );
}

function CardActionLink({ label, href, external = false }) {
  if (!href) {
    return (
      <span className="card-link-button disabled" aria-disabled="true">
        {label}
      </span>
    );
  }

  return (
    <a
      className="card-link-button"
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      {label}
    </a>
  );
}

function FilterSelect({ label, value, onChange, options, emptyLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const optionList = [
    { value: "all", label: emptyLabel },
    ...options.map((option) => ({
      value: option,
      label: option,
    })),
  ];
  const selectedOption = optionList.find((option) => option.value === value) || optionList[0];

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleSelect(nextValue) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={`filter-select ${open ? "open" : ""}`} ref={rootRef}>
      <span>{label}</span>
      <div className="select-shell">
        <button
          type="button"
          className={`select-trigger ${value === "all" ? "placeholder" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selectedOption.label}</span>
          <span className="select-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
        <div className={`select-menu ${open ? "open" : ""}`} role="listbox" aria-label={label}>
          {optionList.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              className={`select-option ${value === option.value ? "selected" : ""}`}
              onClick={() => handleSelect(option.value)}
            >
              <span>{option.label}</span>
              {value === option.value ? <strong>Selected</strong> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, children, onClick }) {
  return (
    <button type="button" className={`filter-chip ${active ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TagList({ items, emptyLabel = "Nothing listed yet.", compact = false, limit = null }) {
  const cleanItems = uniqueValues(items || []);
  if (!cleanItems.length) {
    return <p className="muted">{emptyLabel}</p>;
  }

  const visibleItems = typeof limit === "number" ? cleanItems.slice(0, limit) : cleanItems;
  const remaining = cleanItems.length - visibleItems.length;

  return (
    <div className={`tag-list ${compact ? "compact" : ""}`}>
      {visibleItems.map((item) => (
        <span key={item} className="tag-pill">
          {item}
        </span>
      ))}
      {remaining > 0 ? <span className="tag-pill more-pill">+{remaining} more</span> : null}
    </div>
  );
}

function GallerySection({ items }) {
  const galleryItems = normalizeMediaList(items);
  if (!galleryItems.length) {
    return <p className="muted">No gallery links have been added yet.</p>;
  }

  return (
    <div className="media-grid">
      {galleryItems.map((item) => {
        if (isDirectImageUrl(item)) {
          return (
            <div key={item} className="media-card image-card">
              <img src={ensureUrl(item)} alt="Business gallery preview" loading="lazy" />
              <div className="media-card-body">
                <strong>Image</strong>
                <span>Open the full image in a new tab.</span>
                <a
                  className="media-open-button"
                  href={ensureUrl(item)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open image
                </a>
              </div>
            </div>
          );
        }

        return (
          <div key={item} className="media-card folder-card">
            <strong>{detectGalleryProvider(item)}</strong>
            <span>{describeGalleryLink(item)}</span>
            <a
              className="media-open-button"
              href={ensureUrl(item)}
              target="_blank"
              rel="noreferrer"
            >
              Open gallery
            </a>
          </div>
        );
      })}
    </div>
  );
}

function VideoSection({ items, onOpenVideo }) {
  const videos = normalizeVideoEntries(items);
  if (!videos.length) {
    return <p className="muted">No videos have been added yet.</p>;
  }

  return (
    <div className="video-grid">
      {videos.map((video) => {
        return (
          <button
            key={video.raw}
            type="button"
            className="video-preview-card"
            onClick={() => onOpenVideo(video)}
          >
            <div className="video-preview-thumb">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt={video.title} loading="lazy" />
              ) : (
                <div className="video-preview-fallback">
                  <span>{video.provider}</span>
                </div>
              )}
              <span className="video-play-badge">Play</span>
            </div>
            <div className="video-preview-body">
              <strong>{video.title}</strong>
              <span>{video.provider}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function IconActionLink({ label, href, icon, external = false }) {
  if (!href) {
    return null;
  }

  return (
    <a
      className="icon-action-button"
      href={icon === "email" ? href : ensureUrl(href)}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      aria-label={label}
      title={label}
    >
      {renderActionIcon(icon)}
    </a>
  );
}

function SectionBlock({ title, children }) {
  return (
    <section className="section-block">
      <div className="section-head">
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function BusinessLocationSection({ business }) {
  const mapInfo = getBusinessMapInfo(business);

  if (!mapInfo) {
    return <p className="muted">Live map coordinates have not been added yet.</p>;
  }

  return (
    <div className="location-panel">
      <div className="location-map-shell">
        <iframe
          src={mapInfo.embedUrl}
          title={`${business.name} location map`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <div className="info-grid location-info-grid">
        <InfoItem
          label="Coordinates"
          value={`${formatCoordinate(mapInfo.lat)}, ${formatCoordinate(mapInfo.lng)}`}
        />
        <InfoItem
          label="Coverage"
          value={business.location_label || business.district || "Location not set"}
        />
      </div>
      <div className="icon-action-row location-actions">
        <IconActionLink label="Open Map" href={mapInfo.openUrl} icon="map" external />
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="business-card skeleton-card">
      <div className="card-cover skeleton-block" />
      <div className="card-body">
        <div className="skeleton-line wide" />
        <div className="skeleton-line medium" />
        <div className="skeleton-line short" />
      </div>
    </div>
  );
}

function mergeBusinessSnapshot(summary, detail) {
  if (!summary && !detail) {
    return null;
  }

  return {
    ...(summary || {}),
    ...(detail || {}),
    contact: {
      ...(summary?.contact || {}),
      ...(detail?.contact || {}),
    },
    stats: {
      ...(summary?.stats || {}),
      ...(detail?.stats || {}),
    },
    media: {
      ...(summary?.media || {}),
      ...(detail?.media || {}),
    },
    social: {
      ...(summary?.social || {}),
      ...(detail?.social || {}),
    },
    programs: detail?.programs || summary?.programs || [],
    facilities: detail?.facilities || summary?.facilities || [],
    tags: detail?.tags || summary?.tags || [],
  };
}

function matchesFilters(business, filters, deferredSearch, savedSlugs) {
  const searchTerms = deferredSearch
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const haystack = String(business.search_text || "").toLowerCase();
  const province = business.province_name || business.province;
  const normalizedProvince = normalizeText(province);
  const normalizedDistrict = normalizeText(business.district);
  const normalizedAffiliation = normalizeText(business.affiliation);
  const normalizedType = normalizeText(business.type);

  if (filters.savedOnly && !savedSlugs.includes(business.slug)) {
    return false;
  }
  if (searchTerms.length && !searchTerms.every((term) => haystack.includes(term))) {
    return false;
  }
  if (filters.type !== "all" && normalizedType !== normalizeText(filters.type)) {
    return false;
  }
  if (filters.field !== "all" && !(business.field || []).includes(filters.field)) {
    return false;
  }
  if (filters.level !== "all" && !(business.level || []).includes(filters.level)) {
    return false;
  }
  if (filters.province !== "all" && normalizedProvince !== normalizeText(filters.province)) {
    return false;
  }
  if (filters.district !== "all" && normalizedDistrict !== normalizeText(filters.district)) {
    return false;
  }
  if (filters.affiliation !== "all" && normalizedAffiliation !== normalizeText(filters.affiliation)) {
    return false;
  }

  return true;
}

function sortBusinesses(left, right) {
  const nameCompare = String(left.name || "").localeCompare(String(right.name || ""));
  return nameCompare || String(left.slug || "").localeCompare(String(right.slug || ""));
}

function buildNextRotationProfile(current, businesses) {
  const cycle = Number(current?.cycle) || 0;
  return {
    cycle: cycle + 1,
    fingerprint: (businesses || []).map((business) => business.slug).join("|"),
    refreshed_at: new Date().toISOString(),
  };
}

function rotateBusinessesForDisplay(businesses, rotationProfile, filters) {
  const items = businesses || [];
  if (items.length <= 1) {
    return items;
  }

  const cycle = Number(rotationProfile?.cycle) || 0;
  const filterKey = buildRotationFilterKey(filters);
  const offset = hashText(`${cycle}:${filterKey}`) % items.length;
  if (!offset) {
    return items;
  }

  return items.slice(offset).concat(items.slice(0, offset));
}

function buildRotationFilterKey(filters) {
  return JSON.stringify({
    search: normalizeText(filters?.search),
    type: normalizeText(filters?.type),
    field: normalizeText(filters?.field),
    level: normalizeText(filters?.level),
    province: normalizeText(filters?.province),
    district: normalizeText(filters?.district),
    affiliation: normalizeText(filters?.affiliation),
    savedOnly: Boolean(filters?.savedOnly),
  });
}

function hashText(value) {
  return String(value || "")
    .split("")
    .reduce((total, character, index) => (total + character.charCodeAt(0) * (index + 1)) >>> 0, 0);
}

function normalizeMediaList(items) {
  return [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeVideoEntries(items) {
  return normalizeMediaList(items)
    .map((item, index) => buildVideoEntry(item, index))
    .filter(Boolean);
}

function buildVideoEntry(raw, index) {
  const { title, url } = splitLabeledUrl(raw);
  const safeUrl = ensureUrl(url);
  const provider = detectVideoProvider(safeUrl);
  const derivedTitle = title || buildVideoTitle(safeUrl, provider, index);

  return {
    raw,
    title: derivedTitle,
    url: safeUrl,
    provider,
    thumbnail: getVideoThumbnailUrl(safeUrl),
    embedUrl: getEmbeddedVideoUrl(safeUrl),
    isDirectVideo: isDirectVideoUrl(safeUrl),
  };
}

function splitLabeledUrl(value) {
  const text = String(value || "").trim();
  const delimiterIndex = text.indexOf("|");

  if (delimiterIndex === -1) {
    return {
      title: "",
      url: text,
    };
  }

  const left = text.slice(0, delimiterIndex).trim();
  const right = text.slice(delimiterIndex + 1).trim();

  if (!right) {
    return {
      title: "",
      url: text,
    };
  }

  return {
    title: left,
    url: right,
  };
}

function buildVideoTitle(url, provider, index) {
  if (isDirectVideoUrl(url)) {
    try {
      const parsed = new URL(url);
      const fileName = parsed.pathname.split("/").filter(Boolean).pop() || "";
      return prettifyText(fileName.replace(/\.[a-z0-9]+$/i, "")) || `Video ${index + 1}`;
    } catch {
      return `Video ${index + 1}`;
    }
  }

  return `${provider} ${index + 1}`;
}

function getVideoThumbnailUrl(url) {
  const youtubeId = getYouTubeVideoId(url);
  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  }

  return "";
}

function getYouTubeVideoId(url) {
  const safeUrl = ensureUrl(url);

  try {
    const parsed = new URL(safeUrl);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      return parsed.searchParams.get("v") || "";
    }

    if (host === "youtu.be") {
      return parsed.pathname.replace(/\//g, "");
    }
  } catch {
    return "";
  }

  return "";
}

function prettifyText(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function uniqueValues(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isCertifiedBusiness(business) {
  const rawValue = business?.is_certified;
  if (typeof rawValue === "string") {
    return ["true", "1", "yes", "certified"].includes(normalizeText(rawValue));
  }
  return Boolean(rawValue);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function readCache(key, fallback, storageType = "session") {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const storage = storageType === "local" ? window.localStorage : window.sessionStorage;
    const raw = storage.getItem(key);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return parsed?.data ?? fallback;
  } catch {
    return fallback;
  }
}

function writeCache(key, data, storageType = "session") {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storage = storageType === "local" ? window.localStorage : window.sessionStorage;
    storage.setItem(
      key,
      JSON.stringify({
        saved_at: new Date().toISOString(),
        data,
      })
    );
  } catch {
    // Ignore storage errors.
  }
}

function getInitials(name) {
  return String(name || "Institute")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function buildGradient(seed) {
  const hash = String(seed || "edu")
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  const hue = hash % 360;
  return `linear-gradient(135deg, hsl(${hue} 72% 80%), hsl(${(hue + 48) % 360} 68% 66%))`;
}

function formatArray(items) {
  return (items || []).filter(Boolean).join(", ");
}

function getBusinessCardAddress(business) {
  return business.contact?.address || business.location_label || "Address not set";
}

function buildBusinessLocationLine(business) {
  const mapInfo = getBusinessMapInfo(business);
  if (mapInfo) {
    return `${business.district || business.location_label || "Location"} · ${formatCoordinate(
      mapInfo.lat
    )}, ${formatCoordinate(mapInfo.lng)}`;
  }

  return business.location_label || "Location not set";
}

function getBusinessMapInfo(business) {
  const lat = numberOrNull(business?.contact?.map?.lat);
  const lng = numberOrNull(business?.contact?.map?.lng);

  if (lat === null || lng === null) {
    return null;
  }

  return {
    lat,
    lng,
    embedUrl: buildMapEmbedUrl(lat, lng),
    openUrl: buildMapOpenUrl(lat, lng),
  };
}

function buildMapEmbedUrl(lat, lng) {
  const zoomDelta = 0.018;
  const west = encodeURIComponent((lng - zoomDelta).toFixed(6));
  const south = encodeURIComponent((lat - zoomDelta).toFixed(6));
  const east = encodeURIComponent((lng + zoomDelta).toFixed(6));
  const north = encodeURIComponent((lat + zoomDelta).toFixed(6));
  const marker = `${encodeURIComponent(lat.toFixed(6))}%2C${encodeURIComponent(lng.toFixed(6))}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${marker}`;
}

function buildMapOpenUrl(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(
    lat.toFixed(6)
  )}&mlon=${encodeURIComponent(lng.toFixed(6))}#map=15/${encodeURIComponent(
    lat.toFixed(6)
  )}/${encodeURIComponent(lng.toFixed(6))}`;
}

function formatCoordinate(value) {
  return Number(value).toFixed(4);
}

function getPrimaryPhone(items) {
  return (items || []).map((item) => String(item || "").trim()).find(Boolean) || "";
}

function ensureUrl(url) {
  if (!url) {
    return "#";
  }
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function isDirectImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url);
}

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

function getPreferredCoverImage(business) {
  const candidates = normalizeMediaList([
    business?.cover,
    business?.media?.cover,
    business?.logo,
    business?.media?.logo,
    ...(business?.media?.gallery || []),
  ]);
  const directImage = candidates.find((item) => isDirectImageUrl(item));
  return directImage ? ensureUrl(directImage) : "";
}

function detectGalleryProvider(url) {
  if (/drive\.google\.com/i.test(url)) {
    return "Google Drive gallery";
  }
  if (/mega\.(nz|io)/i.test(url)) {
    return "MEGA gallery";
  }
  if (/dropbox\.com/i.test(url)) {
    return "Dropbox gallery";
  }
  return "Open gallery";
}

function detectVideoProvider(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) {
    return "YouTube video";
  }
  if (/vimeo\.com/i.test(url)) {
    return "Vimeo video";
  }
  if (isDirectVideoUrl(url)) {
    return "Direct video";
  }
  return "External video";
}

function renderActionIcon(icon) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  switch (icon) {
    case "email":
      return (
        <svg {...common}>
          <path d="M4 7h16v10H4z" />
          <path d="m5 8 7 5 7-5" />
        </svg>
      );
    case "website":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a15 15 0 0 1 0 18" />
          <path d="M12 3a15 15 0 0 0 0 18" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z" />
          <circle cx="12" cy="11" r="2.5" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M14 8h3V4h-3c-2.2 0-4 1.8-4 4v3H7v4h3v5h4v-5h3l1-4h-4V8c0-.6.4-1 1-1Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M16.5 7.5h.01" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <path d="M21 12s0-3.2-.4-4.7a2.4 2.4 0 0 0-1.7-1.7C17.4 5 12 5 12 5s-5.4 0-6.9.6a2.4 2.4 0 0 0-1.7 1.7C3 8.8 3 12 3 12s0 3.2.4 4.7a2.4 2.4 0 0 0 1.7 1.7C6.6 19 12 19 12 19s5.4 0 6.9-.6a2.4 2.4 0 0 0 1.7-1.7C21 15.2 21 12 21 12Z" />
          <path d="m10 15 5-3-5-3z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "twitter":
      return (
        <svg {...common}>
          <path d="M4 4 20 20" />
          <path d="M20 4 4 20" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

function describeGalleryLink(url) {
  if (/folders/i.test(url)) {
    return "Open folder";
  }
  try {
    return new URL(ensureUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return "Open link";
  }
}

function getEmbeddedVideoUrl(url) {
  const safeUrl = ensureUrl(url);

  try {
    const parsed = new URL(safeUrl);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (host === "youtu.be") {
      const videoId = parsed.pathname.replace(/\//g, "");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (host === "vimeo.com") {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : "";
    }
  } catch {
    return "";
  }

  return "";
}
