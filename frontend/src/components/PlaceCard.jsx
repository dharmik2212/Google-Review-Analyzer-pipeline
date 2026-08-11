import { motion } from 'framer-motion';
import { Star, MapPin } from 'lucide-react';

export default function PlaceCard({ place, onClick, index }) {
  const initial = place.name ? place.name.charAt(0).toUpperCase() : '?';

  return (
    <motion.div
      className="glass-card place-card"
      onClick={() => onClick(place)}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      id={`place-card-${index}`}
      style={{ padding: 0, overflow: 'hidden' }}
    >
      {/* Top Cover Banner Image */}
      <div className="place-banner-container" style={{ position: 'relative', height: '140px', overflow: 'hidden' }}>
        {place.thumbnail ? (
          <img
            src={place.thumbnail}
            alt={place.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className="place-thumbnail-placeholder" style={{ width: '100%', height: '100%', borderRadius: 0 }}>
            {initial}
          </div>
        )}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(15, 23, 42, 0.9), transparent)'
        }} />
        {place.type && (
          <span style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            color: '#a78bfa',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            {place.type}
          </span>
        )}
      </div>

      {/* Card Content Body */}
      <div style={{ padding: '16px 20px 20px' }}>
        <div className="place-info" style={{ marginBottom: '8px' }}>
          <div className="place-name" title={place.name} style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            {place.name}
          </div>
        </div>

        {place.address && (
          <div className="place-address" style={{ marginBottom: '16px' }}>
            <MapPin size={13} style={{ display: 'inline', marginRight: 4, color: '#a78bfa' }} />
            {place.address}
          </div>
        )}

        <div className="place-meta">
          {place.rating > 0 && (
            <div className="place-rating">
              <Star size={14} fill="#fdcb6e" stroke="#fdcb6e" />
              {place.rating}
            </div>
          )}
          {place.reviews_count > 0 && (
            <span className="place-reviews-count">
              {place.reviews_count.toLocaleString()} reviews
            </span>
          )}
          <button
            type="button"
            className="analyze-badge"
            onClick={(event) => {
              event.stopPropagation();
              onClick(place);
            }}
          >
            Analyze →
          </button>
        </div>
      </div>
    </motion.div>
  );
}
