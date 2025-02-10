import { Rating } from "@prisma/client";

interface RatingProps {
  value: Rating;
  onChange: (rating: Rating) => void;
}

export const StarRating: React.FC<RatingProps> = ({ value, onChange }) => {
  const handleClick = (rating: Rating) => {
    if (rating !== value) {
      onChange(rating);
    }
  };

  return (
    <div className="flex">
      {Object.values(Rating).map((rating) => (
        <span
          key={rating}
          className={`cursor-pointer ${
            value >= rating ? "text-yellow-500" : "text-gray-300"
          }`}
          onClick={() => handleClick(rating)}
        >
          &#9733;
        </span>
      ))}
    </div>
  );
};
