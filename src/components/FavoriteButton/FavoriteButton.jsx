import { useState } from 'react';
import { useFavorites } from '/src/hooks/useFavorites';

export default function FavoriteButton({
  itemId,
  itemType = null,
  size = 24,
  className = "",
  showText = false
}) {
  const { isFavorited, toggleFavorite, isLoggedIn } = useFavorites();
  const [isToggling, setIsToggling] = useState(false);

  // Validate itemId
  if (!itemId || itemId === null || itemId === undefined) {
    console.error('FavoriteButton: itemId is required but got:', itemId);
    return (
      <div style={{ color: 'red', fontSize: '12px' }}>
        Error: No item ID provided
      </div>
    );
  }

  const favorited = isFavorited(itemId);

  const handleToggle = async (e) => {
    e.stopPropagation();
    setIsToggling(true);
    try {
      await toggleFavorite(itemId, itemType);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      alert(`Failed to update favorite: ${error.message}`);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={`favorite-button ${favorited ? 'favorited' : ''} ${className}`}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        opacity: isToggling ? 0.5 : 1,
      }}
      title={
        favorited
          ? 'Remove from favorites'
          : 'Add to favorites'
      }
    >
      <HeartIcon
        size={size}
        filled={favorited}
        loading={isToggling}
      />
      {showText && (
        <span style={{ fontSize: '14px' }}>
          {favorited ? 'Favorited' : 'Favorite'}
        </span>
      )}
    </button>
  );
}

// Simple heart icon component
function HeartIcon({ size = 24, filled = false, loading = false }) {
  if (loading) {
    return (
      <div
        style={{
          width: size,
          height: size,
          border: '2px solid #ccc',
          borderTop: '2px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? '#ff4757' : 'none'}
      stroke={filled ? '#ff4757' : '#ff4757'}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{
        transition: 'all 0.2s ease',
        transform: filled ? 'scale(1.1)' : 'scale(1)'
      }}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}