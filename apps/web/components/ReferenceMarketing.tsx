import Link from 'next/link';
import type { ReactNode } from 'react';
import CampaignImage from './CampaignImage';
import { PublicIcon } from './PublicIcon';

export type ReferenceAction = {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
};

export type ReferenceFeature = {
  icon: string;
  title: string;
  body: string;
  href?: string;
  action?: string;
  image?: string;
};

export type ReferenceStat = {
  icon: string;
  value: string;
  label: string;
};

export type ReferenceSearch = {
  action: string;
  placeholder: string;
  name?: string;
  defaultValue?: string;
  hidden?: { name: string; value: string }[];
};

function Actions({ actions }: { actions: ReferenceAction[] }) {
  return (
    <div className="rp-actions">
      {actions.map((action) => (
        <Link
          key={`${action.href}-${action.label}`}
          href={action.href}
          className={action.variant === 'secondary' ? 'rp-btn rp-btn-secondary' : 'rp-btn rp-btn-primary'}
        >
          {action.label}
          <PublicIcon name={action.variant === 'secondary' ? 'play' : 'arrow'} />
        </Link>
      ))}
    </div>
  );
}

export function ReferencePage({ children }: { children: ReactNode }) {
  return <div className="rp-page">{children}</div>;
}

export function ReferenceHero({
  crumbs,
  eyebrow,
  title,
  lede,
  actions = [],
  image,
  imageAlt,
  callout,
  search,
  variant = 'standard',
}: {
  crumbs: { label: string; href?: string }[];
  eyebrow: string;
  title: ReactNode;
  lede: string;
  actions?: ReferenceAction[];
  image: string;
  imageAlt: string;
  callout?: { icon: string; title: string; body: string };
  search?: ReferenceSearch;
  variant?: 'standard' | 'catalog';
}) {
  return (
    <section className={`rp-hero rp-hero-${variant}`} aria-labelledby="rp-title">
      <nav className="rp-crumbs" aria-label="Breadcrumb">
        <ol>
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`}>
              {index > 0 && <span aria-hidden="true">›</span>}
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <b aria-current="page">{crumb.label}</b>}
            </li>
          ))}
        </ol>
      </nav>
      <div className="rp-hero-grid">
        <div className="rp-hero-copy">
          <p className="rp-eyebrow">{eyebrow}</p>
          <h1 id="rp-title">{title}</h1>
          <p className="rp-lede">{lede}</p>
          {search && (
            <form className="rp-hero-search" action={search.action} method="get" role="search">
              {search.hidden?.map((field) => <input key={field.name} type="hidden" name={field.name} value={field.value} />)}
              <input
                type="search"
                name={search.name ?? 'q'}
                defaultValue={search.defaultValue}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
              />
              <button type="submit" aria-label="Search"><PublicIcon name="search" /></button>
            </form>
          )}
          {actions.length > 0 && <Actions actions={actions} />}
        </div>
        <div className="rp-hero-media">
          <CampaignImage
            src={image}
            category={null}
            campaignKey={`reference-${eyebrow}`}
            alt={imageAlt}
            width={900}
            height={560}
            loading="eager"
            fetchPriority="high"
          />
          {callout && (
            <aside className="rp-hero-callout">
              <span className="rp-icon rp-icon-lg"><PublicIcon name={callout.icon} /></span>
              <div><strong>{callout.title}</strong><p>{callout.body}</p></div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

export function ReferenceSection({
  title,
  intro,
  action,
  children,
  compact = false,
}: {
  title: string;
  intro?: string;
  action?: { label: string; href: string };
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`rp-section${compact ? ' rp-section-compact' : ''}`}>
      <div className="rp-section-head">
        <div>
          <h2>{title}</h2>
          {intro && <p>{intro}</p>}
        </div>
        {action && <Link href={action.href}>{action.label} <PublicIcon name="arrow" /></Link>}
      </div>
      {children}
    </section>
  );
}

export function ReferenceIconGrid({ items, columns = 6 }: { items: ReferenceFeature[]; columns?: 4 | 5 | 6 }) {
  return (
    <div className={`rp-icon-grid rp-cols-${columns}`}>
      {items.map((item, index) => {
        const content = (
          <>
            <span className={`rp-icon rp-icon-tone-${index % 6}`}><PublicIcon name={item.icon} /></span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            {item.action && <span className="rp-card-action">{item.action} <PublicIcon name="arrow" /></span>}
          </>
        );
        return item.href ? <Link className="rp-icon-item" href={item.href} key={item.title}>{content}</Link> : <article className="rp-icon-item" key={item.title}>{content}</article>;
      })}
    </div>
  );
}

export function ReferenceCardGrid({ items, columns = 4 }: { items: ReferenceFeature[]; columns?: 2 | 3 | 4 | 5 }) {
  return (
    <div className={`rp-card-grid rp-card-cols-${columns}`}>
      {items.map((item, index) => {
        const content = (
          <>
            {item.image && (
              <span className="rp-card-media">
                <CampaignImage src={item.image} category={null} campaignKey={`rp-${item.title}`} alt="" width={520} height={320} loading="lazy" />
              </span>
            )}
            <span className="rp-card-body">
              <span className={`rp-icon rp-icon-sm rp-icon-tone-${index % 6}`}><PublicIcon name={item.icon} /></span>
              <strong>{item.title}</strong>
              <span className="rp-card-copy">{item.body}</span>
              {item.action && <span className="rp-card-action">{item.action} <PublicIcon name="arrow" /></span>}
            </span>
          </>
        );
        return item.href ? <Link className="rp-card" href={item.href} key={item.title}>{content}</Link> : <article className="rp-card" key={item.title}>{content}</article>;
      })}
    </div>
  );
}

export function ReferenceStats({ items }: { items: ReferenceStat[] }) {
  return (
    <dl className="rp-stats">
      {items.map((item, index) => (
        <div key={item.label}>
          <span className={`rp-stat-icon rp-icon-tone-${index % 6}`} aria-hidden="true"><PublicIcon name={item.icon} /></span>
          <dd>{item.value}</dd>
          <dt>{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function ReferenceSteps({ items }: { items: ReferenceFeature[] }) {
  return (
    <ol className="rp-steps">
      {items.map((item, index) => (
        <li key={item.title}>
          <div className="rp-step-mark">
            <span className="rp-icon"><PublicIcon name={item.icon} /></span>
            <b>{index + 1}</b>
          </div>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function ReferenceChecklist({ title, items, action }: { title: string; items: string[]; action?: { label: string; href: string } }) {
  return (
    <div className="rp-checklist">
      <h2>{title}</h2>
      <ul>{items.map((item) => <li key={item}><span><PublicIcon name="check" /></span>{item}</li>)}</ul>
      {action && <Link className="rp-text-link" href={action.href}>{action.label} <PublicIcon name="arrow" /></Link>}
    </div>
  );
}

export function ReferenceQuote({ quote, name, context }: { quote: string; name: string; context: string }) {
  return (
    <figure className="rp-quote">
      <span aria-hidden="true">“</span>
      <blockquote>{quote}</blockquote>
      <figcaption><strong>{name}</strong><small>{context}</small></figcaption>
    </figure>
  );
}

export function ReferenceCta({ icon = 'heart', title, body, actions }: { icon?: string; title: string; body: string; actions: ReferenceAction[] }) {
  return (
    <section className="rp-cta">
      <span className="rp-icon rp-icon-lg"><PublicIcon name={icon} /></span>
      <div><h2>{title}</h2><p>{body}</p></div>
      <Actions actions={actions} />
    </section>
  );
}
