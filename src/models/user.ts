import mongoose, { Schema, Document } from 'mongoose';

interface ITestimonial {
    content: string;
    rating: number;
    createdAt: Date;
}

interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    profileImage?: string;
    bio?: string;
    testimonials: ITestimonial[];
    createdAt: Date;
    updatedAt: Date;
}

const testimonialSchema = new Schema<ITestimonial>({
    content: {
        type: String,
        required: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const userSchema = new Schema<IUser>({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    profileImage: String,
    bio: String,
    testimonials: [testimonialSchema],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model<IUser>('User', userSchema);