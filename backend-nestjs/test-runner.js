const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Core Services Test Suite...');
console.log('='.repeat(50));

try {
  // Change to the project directory
  process.chdir(path.join(__dirname, 'stranded-value-scanner'));

  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  console.log('\n🧪 Running tests...');
  execSync('npm test -- --testPathPattern=core-services.test.ts', {
    stdio: 'inherit',
  });

  console.log('\n✅ All tests completed successfully!');
  console.log('='.repeat(50));
} catch (error) {
  console.error('\n❌ Test execution failed:');
  console.error(error.message);

  console.log('\n🔍 Attempting to run basic service validation...');

  try {
    // Try to compile TypeScript to check for syntax errors
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log(
      '✅ TypeScript compilation successful - no syntax errors found!',
    );
  } catch (compileError) {
    console.error('❌ TypeScript compilation failed:');
    console.error(compileError.message);
  }

  process.exit(1);
}
