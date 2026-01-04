import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Category } from '@/types';

interface CategoryCardProps {
  category: Category;
  index?: number;
}

const CategoryCard = ({ category, index = 0 }: CategoryCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link to={`/products?category=${category.slug}`}>
        <div className="group relative aspect-[4/3] rounded-xl overflow-hidden">
          {/* Background Image */}
          <img
            src={category.image}
            alt={category.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/30 to-transparent" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <h3 className="text-xl font-semibold text-primary-foreground mb-1">
              {category.name}
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-primary-foreground/80 text-sm">
                {category.productCount} Products
              </span>
              <span className="flex items-center gap-1 text-primary text-sm font-medium opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                Shop Now
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default CategoryCard;
