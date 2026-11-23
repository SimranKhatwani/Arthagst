import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Tenant from '../tenants/tenant.model.js';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      validate: {
        validator: async function (value) {
          if (!value) return false;
          const tenant = await Tenant.exists({ _id: value });
          return !!tenant;
        },
        message: 'Invalid tenantId: Referenced Tenant does not exist',
      },
      index: true,
    },
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'User name must be at least 2 characters'],
      maxlength: [100, 'User name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Excludes password by default in all queries
    },
    role: {
      type: String,
      enum: {
        values: ['owner', 'admin', 'accountant', 'sales', 'inventory'],
        message: '{VALUE} is not a valid role',
      },
      default: 'admin',
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index: Enforce email uniqueness WITHIN a tenant, not globally across all tenants
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

// Pre-save hook to hash password and normalize fields
userSchema.pre('save', async function () {
  // Normalize email
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }

  // Hash password only if it has been modified or is new
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

/**
 * Compare candidate password with the stored hashed password
 * @param {string} candidatePassword - Plaintext password to verify
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  let hash = this.password;

  // If password was omitted due to select: false, retrieve it for comparison
  if (!hash) {
    const userWithPassword = await mongoose
      .model('User')
      .findById(this._id)
      .select('+password');
    if (!userWithPassword || !userWithPassword.password) {
      return false;
    }
    hash = userWithPassword.password;
  }

  return bcrypt.compare(candidatePassword, hash);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
export { User };
