if (!process.env.CI) {
    console.error('Publishing @solvimon/solvimon-web is only allowed from the CI pipeline');
    process.exit(1);
}
