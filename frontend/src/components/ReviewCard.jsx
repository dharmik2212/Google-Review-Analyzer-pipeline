export default function ReviewCard({ review, index }) {
  const initial = review.author ? review.author.charAt(0).toUpperCase() : 'A';

  const sentimentEmoji = {
    positive: '😊',
    negative: '😠',
    neutral: '😐',
  };

  const renderStars = (rating) => {
    return '★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating));
  };

  return (
    <div className="glass-card review-card" id={`review-card-${index}`}>
      <div className="review-header">
        {review.author_image ? (
          <img src={review.author_image} alt={review.author} className="review-avatar" />
        ) : (
          <div className="review-avatar-placeholder">{initial}</div>
        )}
        <div className="review-author-info">
          <div className="review-author">{review.author}</div>
          <div className="review-date">{review.date}</div>
        </div>
        <div className="review-stars">{renderStars(review.rating)}</div>
        <div className={`sentiment-badge ${review.sentiment.label}`}>
          {sentimentEmoji[review.sentiment.label]} {review.sentiment.label}
        </div>
      </div>

      {review.text && <p className="review-text">{review.text}</p>}

      {review.aspects && review.aspects.length > 0 && (
        <div className="review-aspects">
          {review.aspects.map((aspect) => (
            <span key={aspect} className="aspect-tag">{aspect}</span>
          ))}
        </div>
      )}
    </div>
  );
}
