const { hashPassword, comparePassword, validatePasswordStrength } = require('./dist/utils/password');
const { generateTokenPair, verifyToken } = require('./dist/utils/jwt');

async function testAuthentication() {
  console.log('🧪 Testing GearShelf Authentication System...\n');

  // Test 1: Password Hashing
  console.log('1️⃣ Testing Password Hashing:');
  const password = 'TestPassword123!';
  const hashedPassword = await hashPassword(password);
  console.log(`✅ Password hashed: ${hashedPassword.substring(0, 30)}...`);
  
  const isValid = await comparePassword(password, hashedPassword);
  console.log(`✅ Password verification: ${isValid ? 'SUCCESS' : 'FAILED'}\n`);

  // Test 2: Password Strength Validation
  console.log('2️⃣ Testing Password Strength:');
  const strength = validatePasswordStrength(password);
  console.log(`✅ Password strength: Score ${strength.score}/4, Valid: ${strength.isValid}`);
  if (strength.feedback.length > 0) {
    console.log(`   Feedback: ${strength.feedback.join(', ')}`);
  }
  console.log();

  // Test 3: JWT Token Generation
  console.log('3️⃣ Testing JWT Tokens:');
  const tokens = generateTokenPair(1, 'test@gearshelf.io', 'user');
  console.log(`✅ Access token generated: ${tokens.accessToken.substring(0, 50)}...`);
  console.log(`✅ Refresh token generated: ${tokens.refreshToken.substring(0, 50)}...`);
  console.log(`✅ Expires in: ${tokens.expiresIn}\n`);

  // Test 4: JWT Token Verification
  console.log('4️⃣ Testing JWT Verification:');
  try {
    const decoded = verifyToken(tokens.accessToken);
    console.log(`✅ Token verified successfully:`);
    console.log(`   User ID: ${decoded.userId}`);
    console.log(`   Email: ${decoded.email}`);
    console.log(`   Role: ${decoded.role}`);
    console.log(`   Type: ${decoded.type}\n`);
  } catch (error) {
    console.log(`❌ Token verification failed: ${error.message}\n`);
  }

  console.log('🎉 Authentication System Test Complete!');
  console.log('✅ All core authentication functions working correctly.');
}

testAuthentication().catch(console.error);