if (!process.env.GITLAB_CI) {
    console.error('Publishing @solvimon/sdk is only allowed from GitLab CI.');
    process.exit(1);
}
